import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { applyEMA, resolveInstantaneousSpeedKmh } from './math'
import type {
  GeoPoint,
  GpsErrorInfo,
  GpsSignalStatus,
  TripSettings,
  TripState,
} from './types'

export interface TripTrackerActions {
  startTrip: () => void
  pauseTrip: () => void
  resumeTrip: () => void
  resetTrip: () => void
  ingestGeoPoint: (point: GeoPoint) => void
  setGpsStatus: (status: GpsSignalStatus, error?: GpsErrorInfo | null) => void
  tickTimer: (deltaMs: number) => void
  setSimulating: (isSimulating: boolean) => void
  updateSettings: (partial: Partial<TripSettings>) => void
}

export type TripStore = TripState & TripTrackerActions

const DEFAULT_SETTINGS: TripSettings = {
  emaAlpha: 0.45,
  maxAccuracyMeters: 20,
  autoPauseThresholdKmh: 1.0,
  autoPauseEnabled: true,
}

const INITIAL_TRIP_STATE: Omit<TripState, 'settings'> = {
  status: 'IDLE',
  isAutoPaused: false,
  startTime: null,
  elapsedTimeMs: 0,
  distanceKm: 0,
  currentSpeedKmh: 0,
  rawSpeedKmh: 0,
  maxSpeedKmh: 0,
  averageSpeedKmh: 0,
  coordinates: [],
  lastValidPoint: null,
  gpsStatus: 'IDLE',
  currentAccuracy: null,
  gpsError: null,
  isSimulating: false,
}

const MAX_STORED_COORDINATES = 1000

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_TRIP_STATE,
      settings: DEFAULT_SETTINGS,

      startTrip: () => {
        const now = Date.now()
        set({
          status: 'RUNNING',
          isAutoPaused: false,
          startTime: get().startTime ?? now,
          lastValidPoint: null,
        })
      },

      pauseTrip: () => {
        set({
          status: 'PAUSED',
          isAutoPaused: false,
          currentSpeedKmh: 0,
          rawSpeedKmh: 0,
          lastValidPoint: null,
        })
      },

      resumeTrip: () => {
        set({
          status: 'RUNNING',
          isAutoPaused: false,
          lastValidPoint: null,
        })
      },

      resetTrip: () => {
        const { gpsStatus, currentAccuracy, isSimulating, settings } = get()
        set({
          ...INITIAL_TRIP_STATE,
          gpsStatus,
          currentAccuracy,
          isSimulating,
          settings,
        })
      },

      setGpsStatus: (gpsStatus, gpsError = null) => {
        set({ gpsStatus, gpsError })
      },

      setSimulating: (isSimulating) => {
        set({
          isSimulating,
          lastValidPoint: null,
          currentSpeedKmh: 0,
          rawSpeedKmh: 0,
        })
      },

      updateSettings: (partial) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...partial,
          },
        }))
      },

      ingestGeoPoint: (point: GeoPoint) => {
        const state = get()
        const { settings, lastValidPoint, currentSpeedKmh, status } = state

        // 1. Always record current reported accuracy
        const accuracy = point.accuracy

        // 2. Reject noisy / inaccurate coordinates (accuracy > maxAccuracyMeters)
        if (accuracy > settings.maxAccuracyMeters) {
          set({
            currentAccuracy: accuracy,
            gpsStatus: state.isSimulating ? 'SIMULATING' : 'WEAK_SIGNAL',
          })
          return
        }

        // 3. Calculate raw instantaneous speed & Haversine distance delta
        const { speedKmh: rawInstantSpeedKmh, deltaDistanceMeters } =
          resolveInstantaneousSpeedKmh(point, lastValidPoint)

        // 4. Apply Exponential Moving Average (EMA) smoothing filter
        const smoothedSpeedKmh = applyEMA(
          rawInstantSpeedKmh,
          currentSpeedKmh,
          settings.emaAlpha,
        )

        // Determine if bike is effectively stopped for Auto-Pause
        const isStopped = smoothedSpeedKmh < settings.autoPauseThresholdKmh
        const effectiveSpeedKmh = isStopped ? 0 : smoothedSpeedKmh

        // If trip is not RUNNING, still update live speedometer on screen!
        if (status !== 'RUNNING') {
          set({
            currentAccuracy: accuracy,
            gpsStatus: state.isSimulating ? 'SIMULATING' : 'CONNECTED',
            rawSpeedKmh: rawInstantSpeedKmh,
            currentSpeedKmh: effectiveSpeedKmh,
            lastValidPoint: point,
          })
          return
        }

        const shouldAutoPause = settings.autoPauseEnabled && isStopped

        // Accumulate distance only when moving and not auto-paused
        const addedDistanceKm =
          !shouldAutoPause && deltaDistanceMeters > 0
            ? deltaDistanceMeters / 1000
            : 0

        const newDistanceKm = state.distanceKm + addedDistanceKm
        const newMaxSpeedKmh = Math.max(state.maxSpeedKmh, effectiveSpeedKmh)

        const elapsedHours = state.elapsedTimeMs / 3_600_000
        const newAverageSpeedKmh =
          elapsedHours > 0.0005 ? newDistanceKm / elapsedHours : state.averageSpeedKmh

        const updatedCoords =
          state.coordinates.length >= MAX_STORED_COORDINATES
            ? [...state.coordinates.slice(-MAX_STORED_COORDINATES + 1), point]
            : [...state.coordinates, point]

        set({
          currentAccuracy: accuracy,
          gpsStatus: state.isSimulating ? 'SIMULATING' : 'CONNECTED',
          rawSpeedKmh: rawInstantSpeedKmh,
          currentSpeedKmh: effectiveSpeedKmh,
          maxSpeedKmh: newMaxSpeedKmh,
          distanceKm: newDistanceKm,
          averageSpeedKmh: newAverageSpeedKmh,
          isAutoPaused: shouldAutoPause,
          lastValidPoint: point,
          coordinates: updatedCoords,
        })
      },

      tickTimer: (deltaMs: number) => {
        const state = get()
        const now = Date.now()

        // If last GPS point is stale (> 4.5 seconds old) and speed > 0, decay speed gracefully
        if (
          state.lastValidPoint &&
          now - state.lastValidPoint.timestamp > 4500 &&
          state.currentSpeedKmh > 0
        ) {
          const decayed = applyEMA(0, state.currentSpeedKmh, state.settings.emaAlpha)
          const isStopped = decayed < state.settings.autoPauseThresholdKmh
          set({
            currentSpeedKmh: isStopped ? 0 : decayed,
            rawSpeedKmh: 0,
            isAutoPaused:
              state.status === 'RUNNING' &&
              state.settings.autoPauseEnabled &&
              isStopped,
          })
        }

        if (state.status !== 'RUNNING' || state.isAutoPaused) {
          return
        }

        const newElapsedMs = state.elapsedTimeMs + deltaMs
        const elapsedHours = newElapsedMs / 3_600_000
        const newAverageSpeedKmh =
          elapsedHours > 0.0005 ? state.distanceKm / elapsedHours : 0

        set({
          elapsedTimeMs: newElapsedMs,
          averageSpeedKmh: newAverageSpeedKmh,
        })
      },
    }),
    {
      name: 'bikedash-trip-storage-v1',
      storage: createJSONStorage((): StateStorage => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage
        }
        const memory = new Map<string, string>()
        return {
          getItem: (key) => memory.get(key) ?? null,
          setItem: (key, value) => {
            memory.set(key, value)
          },
          removeItem: (key) => {
            memory.delete(key)
          },
        }
      }),
      partialize: (state) => ({
        status: state.status === 'RUNNING' ? 'PAUSED' : state.status,
        startTime: state.startTime,
        elapsedTimeMs: state.elapsedTimeMs,
        distanceKm: state.distanceKm,
        maxSpeedKmh: state.maxSpeedKmh,
        averageSpeedKmh: state.averageSpeedKmh,
        settings: state.settings,
      }),
    },
  ),
)
