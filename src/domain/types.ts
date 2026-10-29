export type GpsSignalStatus =
  | 'IDLE'
  | 'SEARCHING'
  | 'CONNECTED'
  | 'WEAK_SIGNAL'
  | 'SIMULATING'
  | 'ERROR'

export type TripStatus = 'IDLE' | 'RUNNING' | 'PAUSED'

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
  /** Captured valid coordinates history */
  coordinates: GeoPoint[]
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
