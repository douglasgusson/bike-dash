import { describe, expect, it } from 'vitest'
import {
  perpendicularDistanceMeters,
  processTripRouteGeometry,
  sanitizeAndSortTrackPoints,
  simplifyTrackPointsDouglasPeucker,
} from '../geometry'
import type { TrackPoint } from '../types'

const makeTrackPoint = (
  lat: number,
  lng: number,
  timestamp: number,
): TrackPoint => ({
  tripId: 'trip-geo-test',
  timestamp,
  lat,
  lng,
  alt: 760,
  accuracy: 5,
})

describe('Trip Viewer Geometry & Douglas-Peucker Simplification', () => {
  it('sanitizes invalid (0,0) or NaN points and sorts strictly by ascending timestamp', () => {
    const raw: TrackPoint[] = [
      makeTrackPoint(-23.586, -46.657, 3000),
      makeTrackPoint(0, 0, 2000), // Null Island invalid fix
      makeTrackPoint(Number.NaN, -46.657, 1500),
      makeTrackPoint(-23.588, -46.658, 1000),
    ]

    const sanitized = sanitizeAndSortTrackPoints(raw)
    expect(sanitized).toHaveLength(2)
    expect(sanitized[0].timestamp).toBe(1000)
    expect(sanitized[1].timestamp).toBe(3000)
  })

  it('calculates perpendicular distance in meters accurately', () => {
    const start = { lat: -23.58, lng: -46.65 }
    const end = { lat: -23.57, lng: -46.65 } // ~1.11km due north

    // Point right on the segment
    const onLine = { lat: -23.575, lng: -46.65 }
    expect(perpendicularDistanceMeters(onLine, start, end)).toBeCloseTo(0, 3)

    // Point shifted east by ~0.0001 deg (~10.2m at -23.58 deg latitude)
    const offLine = { lat: -23.575, lng: -46.6499 }
    const dist = perpendicularDistanceMeters(offLine, start, end)
    expect(dist).toBeGreaterThan(9.5)
    expect(dist).toBeLessThan(11.0)
  })

  it('decimates collinear straight-line points while preserving sharp corners (Douglas-Peucker)', () => {
    const points: TrackPoint[] = []
    let t = 1_700_000_000_000

    // 100 collinear points heading north (~5m apart, 0m lateral deviation)
    for (let i = 0; i <= 100; i++) {
      points.push(makeTrackPoint(-23.59 + i * 0.000045, -46.65, (t += 1000)))
    }

    // Sharp 90-degree turn east for another 100 points (~5m apart)
    const cornerLat = -23.59 + 100 * 0.000045
    for (let i = 1; i <= 100; i++) {
      points.push(makeTrackPoint(cornerLat, -46.65 + i * 0.00005, (t += 1000)))
    }

    expect(points).toHaveLength(201)

    // With epsilon = 7 meters, all intermediate collinear points are eliminated,
    // leaving only: Start, 90-deg Corner, and End (3 points total!)
    const simplified = simplifyTrackPointsDouglasPeucker(points, 7)
    expect(simplified).toHaveLength(3)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[1]).toEqual(points[100])
    expect(simplified[2]).toEqual(points[200])
  })

  it('projects simplified TrackPoints into Leaflet [[lat, lng], ...] format', () => {
    const raw: TrackPoint[] = [
      makeTrackPoint(-23.58, -46.65, 2000),
      makeTrackPoint(0, 0, 1500),
      makeTrackPoint(-23.59, -46.65, 1000),
    ]

    const result = processTripRouteGeometry(raw, 7)
    expect(result.rawCount).toBe(3)
    expect(result.sanitizedCount).toBe(2)
    expect(result.simplifiedCount).toBe(2)
    expect(result.polyline).toEqual([
      [-23.59, -46.65],
      [-23.58, -46.65],
    ])
  })
})

