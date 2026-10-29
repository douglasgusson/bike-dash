import type { GeoPoint, GpsErrorInfo, GpsSignalStatus } from '../domain/types'

export type LocationUpdateCallback = (point: GeoPoint) => void
export type LocationStatusCallback = (
  status: GpsSignalStatus,
  error?: GpsErrorInfo | null,
) => void

export interface LocationServiceOptions {
  maxAccuracyMeters?: number
  enableHighAccuracy?: boolean
  timeoutMs?: number
  maximumAgeMs?: number
}

/**
 * Adapter encapsulating browser `navigator.geolocation` and an optional
 * realistic cycling GPS simulator (with synthetic jitter & stops for testing EMA and Auto-Pause).
 */
export class LocationService {
  private watchId: number | null = null
  private simulationIntervalId: ReturnType<typeof setInterval> | null = null
  private onUpdateCallbacks = new Set<LocationUpdateCallback>()
  private onStatusCallbacks = new Set<LocationStatusCallback>()
  private maxAccuracyMeters: number
  private simTick = 0
  private simLat = -23.587416 // Parque Ibirapuera reference coordinate
  private simLon = -46.657634

  constructor(options: LocationServiceOptions = {}) {
    this.maxAccuracyMeters = options.maxAccuracyMeters ?? 20
  }

  public setMaxAccuracyMeters(meters: number): void {
    this.maxAccuracyMeters = meters
  }

  public onUpdate(cb: LocationUpdateCallback): () => void {
    this.onUpdateCallbacks.add(cb)
    return () => this.onUpdateCallbacks.delete(cb)
  }

  public onStatusChange(cb: LocationStatusCallback): () => void {
    this.onStatusCallbacks.add(cb)
    return () => this.onStatusCallbacks.delete(cb)
  }

  private emitUpdate(point: GeoPoint): void {
    for (const cb of this.onUpdateCallbacks) {
      cb(point)
    }
  }

  private emitStatus(status: GpsSignalStatus, error: GpsErrorInfo | null = null): void {
    for (const cb of this.onStatusCallbacks) {
      cb(status, error)
    }
  }

  public startWatching(): void {
    this.stopSimulation()

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.emitStatus('ERROR', {
        code: 0,
        message: 'Geolocalização não suportada neste navegador.',
      })
      return
    }

    if (this.watchId !== null) {
      return
    }

    this.emitStatus('SEARCHING', null)

    this.watchId = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const { coords, timestamp } = position
        const point: GeoPoint = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          altitude: coords.altitude,
          accuracy: coords.accuracy,
          altitudeAccuracy: coords.altitudeAccuracy,
          heading: coords.heading,
          speed: coords.speed,
          timestamp: timestamp || Date.now(),
        }

        if (coords.accuracy > this.maxAccuracyMeters) {
          this.emitStatus('WEAK_SIGNAL', null)
        } else {
          this.emitStatus('CONNECTED', null)
        }

        this.emitUpdate(point)
      },
      (error: GeolocationPositionError) => {
        const messages: Record<number, string> = {
          1: 'Permissão de GPS negada. Libere o acesso à localização.',
          2: 'Sinal de GPS indisponível.',
          3: 'Tempo limite esgotado ao buscar sinal GPS.',
        }
        this.emitStatus('ERROR', {
          code: error.code,
          message: messages[error.code] || error.message || 'Erro de GPS desconhecido',
        })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    )
  }

  public stopWatching(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
  }

  /**
   * Starts a realistic cycling GPS simulation with speed phases, synthetic tree/building jitter,
   * and brief traffic-light stops to test EMA smoothing, Haversine distance, and Auto-Pause.
   */
  public startSimulation(): void {
    this.stopWatching()
    if (this.simulationIntervalId !== null) return

    this.emitStatus('SIMULATING', null)

    this.simulationIntervalId = setInterval(() => {
      this.simTick += 1
      const cycle = this.simTick % 60

      // Simulate a 60-second loop:
      // 0..10s: Accelerating from 18 to 28 km/h
      // 11..35s: Cruising around 26-32 km/h with realistic GPS jitter
      // 36..44s: Sprint around 36 km/h
      // 45..52s: Braking down to 0 km/h
      // 53..59s: Stopped at red light (0 km/h -> triggers Auto-Pause)
      let baseSpeedKmh = 25
      if (cycle < 10) {
        baseSpeedKmh = 14 + cycle * 1.4
      } else if (cycle < 35) {
        baseSpeedKmh = 27 + Math.sin(this.simTick * 0.4) * 3.5
      } else if (cycle < 44) {
        baseSpeedKmh = 35 + Math.cos(this.simTick * 0.5) * 2
      } else if (cycle < 51) {
        baseSpeedKmh = Math.max(0, 32 - (cycle - 44) * 5.5)
      } else {
        baseSpeedKmh = 0
      }

      // Add synthetic GPS jitter (+/- 2.2 km/h) when moving so EMA effect is observable
      const jitterKmh =
        baseSpeedKmh > 0 ? (Math.sin(this.simTick * 1.9) + Math.cos(this.simTick * 3.1)) * 1.2 : 0
      const noisySpeedKmh = Math.max(0, baseSpeedKmh + jitterKmh)
      const speedMps = noisySpeedKmh / 3.6

      // Advance coordinates along a northeast bearing (~45 deg)
      const metersPerDegreeLat = 111_320
      const metersPerDegreeLon = 111_320 * Math.cos((this.simLat * Math.PI) / 180)
      const deltaMeters = speedMps * 1.0 // 1 second interval
      this.simLat += (deltaMeters * 0.7071) / metersPerDegreeLat
      this.simLon += (deltaMeters * 0.7071) / metersPerDegreeLon

      const point: GeoPoint = {
        latitude: this.simLat,
        longitude: this.simLon,
        altitude: 760,
        accuracy: 6 + Math.round(Math.abs(Math.sin(this.simTick * 0.3)) * 5), // 6m - 11m accuracy
        altitudeAccuracy: 4,
        heading: 45,
        speed: speedMps,
        timestamp: Date.now(),
      }

      this.emitStatus('SIMULATING', null)
      this.emitUpdate(point)
    }, 1000)
  }

  public stopSimulation(): void {
    if (this.simulationIntervalId !== null) {
      clearInterval(this.simulationIntervalId)
      this.simulationIntervalId = null
    }
  }

  public stopAll(): void {
    this.stopWatching()
    this.stopSimulation()
    this.emitStatus('IDLE', null)
  }
}

export const locationService = new LocationService()
