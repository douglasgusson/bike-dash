import { beforeEach, describe, expect, it } from 'vitest'
import { onTrackPointValidated, useTripStore } from '../TripTracker'
import type { GeoPoint, TrackPoint } from '../types'
import { buildGpxXml, importGpxToDatabase } from '../../services/GpxExporter'
import {
  clearMemoryTripDb,
  deleteTripCascade,
  flushTrackPointsBatch,
  getAllTrips,
  getTrackPointsByTripId,
  saveTrip,
} from '../../services/TripDatabase'

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

describe('TripTracker Domain Store & Trip Logger', () => {
  beforeEach(() => {
    clearMemoryTripDb()
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

    const capturedPoints: TrackPoint[] = []
    const unsub = onTrackPointValidated((pt) => capturedPoints.push(pt))

    store.ingestGeoPoint(makePoint({ accuracy: 35, speed: 12 }))

    const updated = useTripStore.getState()
    expect(updated.gpsStatus).toBe('WEAK_SIGNAL')
    expect(updated.currentSpeedKmh).toBe(0)
    expect(updated.distanceKm).toBe(0)
    expect(capturedPoints).toHaveLength(0)
    unsub()
  })

  it('calculates EMA speed, distance, and max speed and emits TrackPoints only when speed > 1.0 km/h', () => {
    const store = useTripStore.getState()
    const tripId = store.startTrip()

    const capturedPoints: TrackPoint[] = []
    const unsub = onTrackPointValidated((pt) => capturedPoints.push(pt))

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
    expect(capturedPoints).toHaveLength(1)
    expect(capturedPoints[0].tripId).toBe(tripId)

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
    expect(capturedPoints).toHaveLength(2)

    unsub()
  })

  it('does not emit TrackPoints when stopped at traffic light (speed <= 1.0 km/h)', () => {
    const store = useTripStore.getState()
    store.startTrip()

    const capturedPoints: TrackPoint[] = []
    const unsub = onTrackPointValidated((pt) => capturedPoints.push(pt))

    // Stationary points (0 m/s)
    store.ingestGeoPoint(makePoint({ speed: 0, timestamp: 1000 }))
    store.ingestGeoPoint(makePoint({ speed: 0, timestamp: 2000 }))

    expect(capturedPoints).toHaveLength(0)
    unsub()
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

  it('persists Trip metadata, batch-flushes TrackPoints, exports GPX 1.1, and deletes trip cascade', async () => {
    const tripId = 'trip-test-123'
    const t0 = 1_700_000_000_000

    await saveTrip({
      id: tripId,
      startTime: t0,
      endTime: t0 + 60_000,
      totalDistance: 1.45,
      isFinished: true,
    })

    await flushTrackPointsBatch([
      {
        tripId,
        timestamp: t0 + 2000,
        lat: -23.587,
        lng: -46.657,
        alt: 760,
        accuracy: 5,
      },
      {
        tripId,
        timestamp: t0 + 1000,
        lat: -23.588,
        lng: -46.658,
        alt: 758,
        accuracy: 6,
      },
    ])

    const allTrips = await getAllTrips()
    expect(allTrips).toHaveLength(1)
    expect(allTrips[0].id).toBe(tripId)

    // Should return points sorted chronologically by timestamp
    const orderedPoints = await getTrackPointsByTripId(tripId)
    expect(orderedPoints).toHaveLength(2)
    expect(orderedPoints[0].timestamp).toBe(t0 + 1000)
    expect(orderedPoints[1].timestamp).toBe(t0 + 2000)

    const gpxXml = buildGpxXml(allTrips[0], orderedPoints)
    expect(gpxXml).toContain('<gpx version="1.1"')
    expect(gpxXml).toContain('<trkpt lat="-23.588000" lon="-46.658000">')
    expect(gpxXml).toContain('<ele>758.0</ele>')

    // Cascade delete both trip metadata and trackpoints
    await deleteTripCascade(tripId)
    expect(await getAllTrips()).toHaveLength(0)
    expect(await getTrackPointsByTripId(tripId)).toHaveLength(0)

    // Re-import the exported GPX XML string into IndexedDB
    const imported = await importGpxToDatabase(gpxXml)
    expect(imported.pointCount).toBe(2)
    expect(imported.trip.totalDistance).toBeGreaterThan(0.1)

    const tripsAfterImport = await getAllTrips()
    expect(tripsAfterImport).toHaveLength(1)
    const importedPoints = await getTrackPointsByTripId(imported.trip.id)
    expect(importedPoints).toHaveLength(2)
  })
})
