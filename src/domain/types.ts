export type GpsSignalStatus =
  | 'IDLE'
  | 'SEARCHING'
  | 'CONNECTED'
  | 'WEAK_SIGNAL'
  | 'SIMULATING'
  | 'ERROR'

export type TripStatus = 'IDLE' | 'RUNNING' | 'PAUSED'

export interface Trip {
  id: string // UUID (ex: crypto.randomUUID()) ou timestamp de início
  startTime: number // Epoch timestamp
  endTime: number | null
  totalDistance: number // Atualizado periodicamente ou ao final (em km)
  elapsedTimeMs?: number // Tempo ativo de pedalada (descontando pausas/auto-pause)
  averageSpeedKmh?: number // Velocidade média da sessão em km/h
  maxSpeedKmh?: number // Velocidade máxima atingida em km/h
  isFinished: boolean
}

export interface TrackPoint {
  tripId: string // Foreign key para agrupar na query
  timestamp: number // Epoch (Primary Key composta ou Index)
  lat: number
  lng: number
  alt: number | null
  accuracy: number // Útil para debugging ou pós-processamento da rota
}

export interface GeoPoint {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number
  altitudeAccuracy: number | null
  heading: number | null
  /** Speed in meters per second (m/s) provided by hardware, or null if unavailable */
  speed: number | null
  timestamp: number
}

export interface GpsErrorInfo {
  code: number
  message: string
}

export interface TripSettings {
  /** Exponential Moving Average smoothing factor (0.1 to 1.0, recommended 0.3 - 0.6) */
  emaAlpha: number
  /** Maximum acceptable GPS accuracy margin in meters (e.g. 20m) */
  maxAccuracyMeters: number
  /** Minimum speed in km/h below which the bike is considered stopped (auto-pause threshold) */
  autoPauseThresholdKmh: number
  /** Enable automatic timer pause when speed is zero */
  autoPauseEnabled: boolean
}

export interface TripState {
  status: TripStatus
  currentTripId: string | null
  lastCompletedTripId: string | null
  isAutoPaused: boolean
  startTime: number | null
  /** Active pedaling time in milliseconds */
  elapsedTimeMs: number
  /** Total distance traveled in kilometers */
  distanceKm: number
  /** Current smoothed speed in km/h */
  currentSpeedKmh: number
  /** Raw unsmoothed speed in km/h (useful for field calibration) */
  rawSpeedKmh: number
  /** Maximum speed reached in current trip in km/h */
  maxSpeedKmh: number
  /** Average active speed in km/h */
  averageSpeedKmh: number
  /** Last accepted GPS point for delta calculations */
  lastValidPoint: GeoPoint | null
  /** Current GPS status */
  gpsStatus: GpsSignalStatus
  /** Latest reported GPS accuracy in meters */
  currentAccuracy: number | null
  /** Latest GPS error if any */
  gpsError: GpsErrorInfo | null
  /** Whether built-in route simulation is active */
  isSimulating: boolean
  /** Configurable domain parameters */
  settings: TripSettings
}
