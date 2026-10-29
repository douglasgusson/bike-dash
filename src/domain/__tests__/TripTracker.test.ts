import { beforeEach, describe, expect, it } from 'vitest'
import { useTripStore } from '../TripTracker'
import type { GeoPoint } from '../types'

const makePoint = (overrides: Partial<GeoPoint> = {}): GeoPoint => ({
  latitude: -23.587416,
  longitude: -46.657634,
  altitude: 760,
  accuracy: 6,
  altitudeAccuracy: 4,
  heading: 90,
  speed: 8, // 28.8 km/h
  timestamp: Date.now(),
  ...overrides,
})

describe('TripTracker Domain Store', () => {
  beforeEach(() => {
    useTripStore.getState().resetTrip()
    useTripStore.getState().updateSettings({
      emaAlpha: 0.5,
      maxAccuracyMeters: 20,
      autoPauseThresholdKmh: 1.0,
      autoPauseEnabled: true,
    })
  })

  it('ignores noisy GPS points where accuracy > maxAccuracyMeters (20m)', () => {
    const store = useTripStore.getState()
    store.startTrip()

    store.ingestGeoPoint(makePoint({ accuracy: 35, speed: 12 }))

    const updated = useTripStore.getState()
    expect(updated.gpsStatus).toBe('WEAK_SIGNAL')
    expect(updated.currentSpeedKmh).toBe(0)
    expect(updated.distanceKm).toBe(0)
    expect(updated.coordinates).toHaveLength(0)
  })

  it('calculates EMA speed, distance, and max speed during an active trip', () => {
    const store = useTripStore.getState()
    store.startTrip()

    const t0 = 1_700_000_000_000
    // Point 1: 10 m/s = 36 km/h. With EMA alpha=0.5 from 0 => 18 km/h
    store.ingestGeoPoint(
      makePoint({
        latitude: -23.587416,
        longitude: -46.657634,
        speed: 10,
        timestamp: t0,
      }),
    )

    expect(useTripStore.getState().currentSpeedKmh).toBeCloseTo(18, 2)

    // Point 2: ~100m north, 10 m/s = 36 km/h. EMA: 0.5*36 + 0.5*18 = 27 km/h
    store.ingestGeoPoint(
      makePoint({
        latitude: -23.586517,
        longitude: -46.657634,
        speed: 10,
        timestamp: t0 + 10_000,
      }),
    )

    const afterSecond = useTripStore.getState()
    expect(afterSecond.currentSpeedKmh).toBeCloseTo(27, 2)
    expect(afterSecond.maxSpeedKmh).toBeCloseTo(27, 2)
    expect(afterSecond.distanceKm).toBeCloseTo(0.1, 2)
  })

  it('triggers Auto-Pause when speed drops to zero and pauses elapsed time counter', () => {
    const store = useTripStore.getState()
    store.startTrip()

    // Moving point
    store.ingestGeoPoint(makePoint({ speed: 8, timestamp: 1000 }))
    store.tickTimer(5000)
    expect(useTripStore.getState().elapsedTimeMs).toBe(5000)
    expect(useTripStore.getState().isAutoPaused).toBe(false)

    // Stopped points until EMA drops below threshold (1.0 km/h)
    for (let i = 1; i <= 6; i++) {
      store.ingestGeoPoint(makePoint({ speed: 0, timestamp: 1000 + i * 1000 }))
    }

    const pausedState = useTripStore.getState()
    expect(pausedState.currentSpeedKmh).toBe(0)
    expect(pausedState.isAutoPaused).toBe(true)

    // Ticking timer while auto-paused should NOT increment elapsedTimeMs
    store.tickTimer(5000)
    expect(useTripStore.getState().elapsedTimeMs).toBe(5000)
  })
})
