import type { TrackPoint } from './types'

const METERS_PER_DEGREE_LAT = 111_320

export type LatLngTuple = [number, number]

/**
 * Checks whether a TrackPoint has valid, finite, non-(0,0) geographic coordinates.
 */
export function isValidTrackPoint(point: TrackPoint | null | undefined): point is TrackPoint {
  if (!point) return false
  const { lat, lng, timestamp } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) {
    return false
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false
  }
  // Reject (0,0) Null Island invalid GPS fixes
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) {
    return false
  }
  return true
}

/**
 * Sanitizes and sorts TrackPoints strictly by ascending timestamp.
 */
export function sanitizeAndSortTrackPoints(points: TrackPoint[]): TrackPoint[] {
  return points
    .filter(isValidTrackPoint)
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Calculates the perpendicular distance in meters from a point `pt` to the line segment `lineStart -> lineEnd`
 * using a local equirectangular metric projection around the segment's latitude.
 */
export function perpendicularDistanceMeters(
  pt: Pick<TrackPoint, 'lat' | 'lng'>,
  lineStart: Pick<TrackPoint, 'lat' | 'lng'>,
  lineEnd: Pick<TrackPoint, 'lat' | 'lng'>,
): number {
  const refLatRad = (((lineStart.lat + lineEnd.lat) / 2) * Math.PI) / 180
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(refLatRad)

  const x0 = (pt.lng - lineStart.lng) * metersPerDegreeLng
  const y0 = (pt.lat - lineStart.lat) * METERS_PER_DEGREE_LAT

  const dx = (lineEnd.lng - lineStart.lng) * metersPerDegreeLng
  const dy = (lineEnd.lat - lineStart.lat) * METERS_PER_DEGREE_LAT

  const segmentLenSq = dx * dx + dy * dy
  if (segmentLenSq === 0) {
    return Math.hypot(x0, y0)
  }

  // Projection parameter t clamped to [0, 1] for true segment distance
  const t = Math.max(0, Math.min(1, (x0 * dx + y0 * dy) / segmentLenSq))
  const projX = t * dx
  const projY = t * dy

  return Math.hypot(x0 - projX, y0 - projY)
}

/**
 * Simplifies a chronological array of TrackPoints using the iterative Ramer-Douglas-Peucker
 * algorithm with a metric tolerance (`epsilonMeters`, default 7m).
 */
export function simplifyTrackPointsDouglasPeucker(
  points: TrackPoint[],
  epsilonMeters = 7,
): TrackPoint[] {
  if (points.length <= 2 || epsilonMeters <= 0) {
    return [...points]
  }

  const n = points.length
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1

  const stack: Array<[number, number]> = [[0, n - 1]]

  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop()!
    if (endIdx - startIdx <= 1) continue

    let maxDist = 0
    let maxIdx = startIdx

    const startPt = points[startIdx]
    const endPt = points[endIdx]

    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistanceMeters(points[i], startPt, endPt)
      if (dist > maxDist) {
        maxDist = dist
        maxIdx = i
      }
    }

    if (maxDist > epsilonMeters) {
      keep[maxIdx] = 1
      stack.push([startIdx, maxIdx], [maxIdx, endIdx])
    }
  }

  const result: TrackPoint[] = []
  for (let i = 0; i < n; i++) {
    if (keep[i] === 1) {
      result.push(points[i])
    }
  }
  return result
}

/**
 * Full Trip Viewer geometry pipeline:
 * 1. Sanitizes invalid coordinates (0,0 / NaN / null) and sorts ascending by `timestamp`
 * 2. Decimates redundant collinear vertices via Douglas-Peucker (`epsilonMeters`)
 * 3. Projects to Leaflet polyline coordinates `[[lat, lng], ...]`
 */
export function processTripRouteGeometry(
  rawPoints: TrackPoint[],
  epsilonMeters = 7,
): {
  rawCount: number
  sanitizedCount: number
  simplifiedCount: number
  polyline: LatLngTuple[]
} {
  const sanitized = sanitizeAndSortTrackPoints(rawPoints)
  const simplified = simplifyTrackPointsDouglasPeucker(sanitized, epsilonMeters)
  const polyline: LatLngTuple[] = simplified.map((pt) => [pt.lat, pt.lng])

  return {
    rawCount: rawPoints.length,
    sanitizedCount: sanitized.length,
    simplifiedCount: simplified.length,
    polyline,
  }
}

