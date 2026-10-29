import { describe, expect, it } from 'vitest'
import {
  applyEMA,
  calculateHaversineDistanceMeters,
  formatDuration,
  mpsToKmh,
  resolveInstantaneousSpeedKmh,
} from '../math'
import type { GeoPoint } from '../types'

describe('Mathematical Engine (math.ts)', () => {
  it('calculates Haversine distance accurately between two coordinates', () => {
    const pointA = { latitude: -23.587416, longitude: -46.657634 }
    // ~1000 meters north along the same meridian
    const pointB = { latitude: -23.578423, longitude: -46.657634 }

    const distance = calculateHaversineDistanceMeters(pointA, pointB)
    expect(distance).toBeGreaterThan(995)
    expect(distance).toBeLessThan(1005)
  })

  it('converts m/s to km/h and guards against negative/NaN values', () => {
    expect(mpsToKmh(10)).toBeCloseTo(36, 5)
    expect(mpsToKmh(-5)).toBe(0)
    expect(mpsToKmh(Number.NaN)).toBe(0)
  })

  it('applies Exponential Moving Average (EMA) smoothing formula accurately', () => {
    // currentSpeed = (newSpeed * alpha) + (previousSpeed * (1 - alpha))
    // (25 * 0.4) + (15 * 0.6) = 10 + 9 = 19 km/h
    const smoothed = applyEMA(25, 15, 0.4)
    expect(smoothed).toBeCloseTo(19, 5)
  })

  it('snaps negligible EMA tails (< 0.3 km/h) to zero', () => {
    expect(applyEMA(0, 0.25, 0.4)).toBe(0)
  })

  it('falls back to Haversine speed when device speed is null', () => {
    const t0 = 1_700_000_000_000
    const prev: GeoPoint = {
      latitude: -23.587416,
      longitude: -46.657634,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      timestamp: t0,
    }
    // ~100 meters north in 10 seconds => 10 m/s => 36 km/h
    const curr: GeoPoint = {
      ...prev,
      latitude: -23.586517,
      timestamp: t0 + 10_000,
    }

    const { speedKmh, deltaDistanceMeters } = resolveInstantaneousSpeedKmh(curr, prev)
    expect(deltaDistanceMeters).toBeGreaterThan(98)
    expect(deltaDistanceMeters).toBeLessThan(102)
    expect(speedKmh).toBeGreaterThan(35)
    expect(speedKmh).toBeLessThan(37)
  })

  it('formats durations as MM:SS and HH:MM:SS', () => {
    expect(formatDuration(65_000)).toBe('01:05')
    expect(formatDuration(3_665_000)).toBe('01:01:05')
  })
})
