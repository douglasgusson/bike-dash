import type { GeoPoint } from './types'

const EARTH_RADIUS_METERS = 6_371_000

/**
 * Converts degrees to radians.
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculates the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @returns Distance in meters (m)
 */
export function calculateHaversineDistanceMeters(
  pointA: Pick<GeoPoint, 'latitude' | 'longitude'>,
  pointB: Pick<GeoPoint, 'latitude' | 'longitude'>,
): number {
  const dLat = toRadians(pointB.latitude - pointA.latitude)
  const dLon = toRadians(pointB.longitude - pointA.longitude)

  const lat1 = toRadians(pointA.latitude)
  const lat2 = toRadians(pointB.latitude)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)

  const a =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))

  return EARTH_RADIUS_METERS * c
}

/**
 * Converts meters per second (m/s) to kilometers per hour (km/h).
 */
export function mpsToKmh(mps: number): number {
  if (!Number.isFinite(mps) || mps < 0) return 0
  return mps * 3.6
}

/**
 * Exponential Moving Average (EMA) filter to mitigate GPS speed jitter.
 * Formula: currentSpeed = (newSpeed * alpha) + (previousSpeed * (1 - alpha))
 *
 * @param newSpeed Latest instantaneous speed (km/h)
 * @param previousSpeed Previously smoothed speed (km/h)
 * @param alpha Smoothing factor between 0.1 and 1.0 (recommended 0.3 to 0.6)
 */
export function applyEMA(
  newSpeed: number,
  previousSpeed: number,
  alpha: number,
): number {
  const clampedAlpha = Math.min(1, Math.max(0.05, alpha))
  const smoothed = newSpeed * clampedAlpha + previousSpeed * (1 - clampedAlpha)
  // Snap to zero if negligible to prevent infinite exponential decay tail when stopped
  return smoothed < 0.3 ? 0 : smoothed
}

/**
 * Derives instantaneous speed in km/h from a new GeoPoint and an optional previous GeoPoint.
 * Uses hardware Doppler speed (`point.speed`) when valid, falling back to Haversine delta / time delta.
 */
export function resolveInstantaneousSpeedKmh(
  currentPoint: GeoPoint,
  previousPoint: GeoPoint | null,
): { speedKmh: number; deltaDistanceMeters: number } {
  let deltaDistanceMeters = 0

  if (previousPoint) {
    deltaDistanceMeters = calculateHaversineDistanceMeters(
      previousPoint,
      currentPoint,
    )
    // Ignore microscopic GPS jitter when virtually stationary (< 1.5m)
    if (deltaDistanceMeters < 1.5 && (currentPoint.speed === null || currentPoint.speed < 0.4)) {
      deltaDistanceMeters = 0
    }
  }

  // Primary source: Native Geolocation speed (m/s) if provided and non-negative
  if (currentPoint.speed !== null && Number.isFinite(currentPoint.speed) && currentPoint.speed >= 0) {
    return {
      speedKmh: mpsToKmh(currentPoint.speed),
      deltaDistanceMeters,
    }
  }

  // Fallback source: Haversine distance divided by elapsed time between GPS fixes
  if (previousPoint) {
    const deltaTimeSeconds = (currentPoint.timestamp - previousPoint.timestamp) / 1000
    if (deltaTimeSeconds > 0.2 && deltaDistanceMeters > 0) {
      const derivedMps = deltaDistanceMeters / deltaTimeSeconds
      const derivedKmh = mpsToKmh(derivedMps)
      // Sanity cap against impossible GPS teleports (> 130 km/h on a bike)
      if (derivedKmh <= 130) {
        return {
          speedKmh: derivedKmh,
          deltaDistanceMeters,
        }
      }
      return { speedKmh: 0, deltaDistanceMeters: 0 }
    }
  }

  return { speedKmh: 0, deltaDistanceMeters }
}

/**
 * Formats milliseconds into HH:MM:SS or MM:SS for outdoor display.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}
