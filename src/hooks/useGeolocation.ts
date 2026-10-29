import { useEffect } from 'react'
import { useTripStore } from '../domain/TripTracker'
import { locationService } from '../services/LocationService'

/**
 * Connects the LocationService adapter and active pedaling clock
 * with the Zustand TripTracker store.
 */
export function useGeolocation(): void {
  const isSimulating = useTripStore((s) => s.isSimulating)
  const maxAccuracyMeters = useTripStore((s) => s.settings.maxAccuracyMeters)

  // Sync accuracy threshold with LocationService
  useEffect(() => {
    locationService.setMaxAccuracyMeters(maxAccuracyMeters)
  }, [maxAccuracyMeters])

  // Subscribe to GPS updates & status changes
  useEffect(() => {
    const unsubscribeUpdate = locationService.onUpdate((point) => {
      useTripStore.getState().ingestGeoPoint(point)
    })

    const unsubscribeStatus = locationService.onStatusChange((status, error) => {
      useTripStore.getState().setGpsStatus(status, error)
    })

    if (isSimulating) {
      locationService.startSimulation()
    } else {
      locationService.startWatching()
    }

    return () => {
      unsubscribeUpdate()
      unsubscribeStatus()
      locationService.stopAll()
    }
  }, [isSimulating])

  // 1-second active pedaling timer
  useEffect(() => {
    let lastTick = performance.now()
    const interval = setInterval(() => {
      const now = performance.now()
      const deltaMs = Math.round(now - lastTick)
      lastTick = now
      useTripStore.getState().tickTimer(deltaMs)
    }, 1000)

    return () => clearInterval(interval)
  }, [])
}
