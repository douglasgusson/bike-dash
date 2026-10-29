import { useCallback, useEffect, useRef } from 'react'
import { onTrackPointValidated, useTripStore } from '../domain/TripTracker'
import type { TrackPoint, Trip } from '../domain/types'
import {
  deleteTripCascade,
  flushTrackPointsBatch,
  saveTrip,
  updateTripMetadata,
} from '../services/TripDatabase'

export const POINT_BUFFER_MAX_SIZE = 30
export const POINT_BUFFER_FLUSH_INTERVAL_MS = 30_000

export interface TripLoggerController {
  startNewTrip: () => Promise<string>
  stopAndFinishTrip: () => Promise<string | null>
  discardCurrentTrip: () => Promise<void>
  flushBufferNow: () => Promise<void>
}

/**
 * Manages the in-memory `useRef<TrackPoint[]>` buffer and periodic/batch
 * flushes to IndexedDB (`bikedash_db`) without triggering React re-renders.
 */
export function useTripLogger(): TripLoggerController {
  const pointBuffer = useRef<TrackPoint[]>([])
  const isFlushingRef = useRef(false)

  const flushBufferNow = useCallback(async () => {
    if (isFlushingRef.current || pointBuffer.current.length === 0) {
      return
    }

    isFlushingRef.current = true
    // Drain buffer immediately into local snapshot so incoming points don't get lost
    const snapshot = pointBuffer.current.splice(0, pointBuffer.current.length)

    try {
      await flushTrackPointsBatch(snapshot)

      const {
        currentTripId,
        distanceKm,
        elapsedTimeMs,
        averageSpeedKmh,
        maxSpeedKmh,
      } = useTripStore.getState()
      if (currentTripId) {
        await updateTripMetadata(currentTripId, {
          totalDistance: distanceKm,
          elapsedTimeMs,
          averageSpeedKmh,
          maxSpeedKmh,
        })
      }
    } catch (err) {
      // Put points back at the front of the buffer if IndexedDB transaction failed
      pointBuffer.current.unshift(...snapshot)
      console.error('[BikeDash TripLogger] Failed to flush trackpoints batch:', err)
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  // Subscribe to validated moving coordinates emitted by the domain engine
  useEffect(() => {
    const unsubscribe = onTrackPointValidated((trackPoint, speedKmh) => {
      // Guard: only record when GPS is fixed in movement (> 1.0 km/h)
      if (speedKmh <= 1.0) return

      pointBuffer.current.push(trackPoint)

      if (pointBuffer.current.length >= POINT_BUFFER_MAX_SIZE) {
        void flushBufferNow()
      }
    })

    return unsubscribe
  }, [flushBufferNow])

  // Periodic 30-second flush timer while a trip is active
  const status = useTripStore((s) => s.status)
  useEffect(() => {
    if (status === 'IDLE') return

    const interval = setInterval(() => {
      void flushBufferNow()
    }, POINT_BUFFER_FLUSH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status, flushBufferNow])

  // Flush remaining points if user pauses or backgrounds the PWA
  useEffect(() => {
    if (status === 'PAUSED') {
      void flushBufferNow()
    }
  }, [status, flushBufferNow])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushBufferNow()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [flushBufferNow])

  const startNewTrip = useCallback(async (): Promise<string> => {
    pointBuffer.current = []
    const tripId = useTripStore.getState().startTrip()
    const state = useTripStore.getState()
    const now = state.startTime ?? Date.now()

    const newTrip: Trip = {
      id: tripId,
      startTime: now,
      endTime: null,
      totalDistance: state.distanceKm,
      elapsedTimeMs: state.elapsedTimeMs,
      averageSpeedKmh: state.averageSpeedKmh,
      maxSpeedKmh: state.maxSpeedKmh,
      isFinished: false,
    }

    await saveTrip(newTrip)
    return tripId
  }, [])

  const stopAndFinishTrip = useCallback(async (): Promise<string | null> => {
    const state = useTripStore.getState()
    const activeTripId = state.currentTripId
    const finalDistanceKm = state.distanceKm
    const finalElapsedMs = state.elapsedTimeMs
    const finalAvgSpeedKmh = state.averageSpeedKmh
    const finalMaxSpeedKmh = state.maxSpeedKmh
    const startTime = state.startTime ?? Date.now()

    // 1. Final flush of any remaining points in `pointBuffer`
    await flushBufferNow()

    // 2. Mark trip as finished in IndexedDB `trips` store
    if (activeTripId) {
      const updated = await updateTripMetadata(activeTripId, {
        endTime: Date.now(),
        totalDistance: finalDistanceKm,
        elapsedTimeMs: finalElapsedMs,
        averageSpeedKmh: finalAvgSpeedKmh,
        maxSpeedKmh: finalMaxSpeedKmh,
        isFinished: true,
      })

      if (!updated) {
        await saveTrip({
          id: activeTripId,
          startTime,
          endTime: Date.now(),
          totalDistance: finalDistanceKm,
          elapsedTimeMs: finalElapsedMs,
          averageSpeedKmh: finalAvgSpeedKmh,
          maxSpeedKmh: finalMaxSpeedKmh,
          isFinished: true,
        })
      }
    }

    // 3. Reset live metrics in store and expose `lastCompletedTripId` for Export/Discard UI
    return useTripStore.getState().finishTrip()
  }, [flushBufferNow])

  const discardCurrentTrip = useCallback(async (): Promise<void> => {
    pointBuffer.current = []
    const { currentTripId, lastCompletedTripId } = useTripStore.getState()
    const targetId = currentTripId ?? lastCompletedTripId

    useTripStore.getState().resetTrip()

    if (targetId) {
      await deleteTripCascade(targetId)
    }
  }, [])

  return {
    startNewTrip,
    stopAndFinishTrip,
    discardCurrentTrip,
    flushBufferNow,
  }
}

