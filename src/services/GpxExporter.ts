import { applyEMA, calculateHaversineDistanceMeters, mpsToKmh } from '../domain/math'
import type { TrackPoint, Trip } from '../domain/types'
import {
  flushTrackPointsBatch,
  getTrackPointsByTripId,
  getTripById,
  saveTrip,
} from './TripDatabase'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generates a GPX 1.1 XML string compatible with Strava, Garmin Connect, and GPX Viewer.
 */
export function buildGpxXml(trip: Trip, points: TrackPoint[]): string {
  const startIso = new Date(trip.startTime).toISOString()
  const tripTitle = `BikeDash Pedal ${startIso.slice(0, 10)}`

  const trkptsXml = points
    .map((pt) => {
      const timeIso = new Date(pt.timestamp).toISOString()
      const eleTag =
        pt.alt !== null && Number.isFinite(pt.alt)
          ? `\n        <ele>${pt.alt.toFixed(1)}</ele>`
          : ''
      const hdopTag =
        Number.isFinite(pt.accuracy) && pt.accuracy > 0
          ? `\n        <hdop>${pt.accuracy.toFixed(1)}</hdop>`
          : ''

      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleTag}
        <time>${timeIso}</time>${hdopTag}
      </trkpt>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeDash PWA - Offline-First Cyclocomputer" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(tripTitle)}</name>
    <time>${startIso}</time>
  </metadata>
  <trk>
    <name>${escapeXml(tripTitle)}</name>
    <type>cycling</type>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`
}

/**
 * Queries IndexedDB for the trip and its ordered trackpoints, generates the `.gpx` file,
 * and triggers a client-side browser download using Blob and URL.createObjectURL.
 */
export async function exportTripToGpxDownload(tripId: string): Promise<{
  filename: string
  pointCount: number
}> {
  const [trip, points] = await Promise.all([
    getTripById(tripId),
    getTrackPointsByTripId(tripId),
  ])

  const resolvedTrip: Trip = trip ?? {
    id: tripId,
    startTime: points[0]?.timestamp ?? Date.now(),
    endTime: points[points.length - 1]?.timestamp ?? Date.now(),
    totalDistance: 0,
    isFinished: true,
  }

  const gpxXml = buildGpxXml(resolvedTrip, points)
  const datePart = new Date(resolvedTrip.startTime)
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)
  const filename = `bikedash-${datePart}.gpx`

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 5000)
  }

  return {
    filename,
    pointCount: points.length,
  }
}

function generateImportedTripId(startTime: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `imported-${startTime}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Parses a GPX 1.0 / 1.1 XML string (exported from BikeDash, Strava, Garmin, etc.)
 * into a structured `Trip` metadata object and chronological `TrackPoint[]` array.
 */
export function parseGpxXml(
  gpxContent: string,
  customTripId?: string,
): {
  trip: Trip
  points: TrackPoint[]
} {
  const tripId = customTripId ?? generateImportedTripId(Date.now())
  const rawPoints: Array<{
    lat: number
    lng: number
    alt: number | null
    accuracy: number
    timestamp: number
  }> = []

  // Match all <trkpt ...>...</trkpt>, self-closing <trkpt .../>, or <rtept ...> tags
  const ptRegex = /<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/gi
  const latRegex = /\blat=["']([^"']+)["']/i
  const lonRegex = /\blon=["']([^"']+)["']/i
  const eleRegex = /<ele>\s*([^<\s]+)\s*<\/ele>/i
  const timeRegex = /<time>\s*([^<\s]+)\s*<\/time>/i
  const hdopRegex = /<hdop>\s*([^<\s]+)\s*<\/hdop>/i

  let baseFallbackTime = Date.now()
  const metadataTimeMatch = gpxContent.match(/<metadata[\s\S]*?<time>\s*([^<\s]+)\s*<\/time>/i)
  if (metadataTimeMatch) {
    const parsedMeta = Date.parse(metadataTimeMatch[1])
    if (Number.isFinite(parsedMeta)) {
      baseFallbackTime = parsedMeta
    }
  }

  let match: RegExpExecArray | null
  let index = 0
  while ((match = ptRegex.exec(gpxContent)) !== null) {
    const attrs = match[1] ?? ''
    const inner = match[2] ?? ''

    const latMatch = attrs.match(latRegex)
    const lonMatch = attrs.match(lonRegex)
    if (!latMatch || !lonMatch) continue

    const lat = parseFloat(latMatch[1])
    const lng = parseFloat(lonMatch[1])
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)
    ) {
      continue
    }

    const eleMatch = inner.match(eleRegex)
    const parsedAlt = eleMatch ? parseFloat(eleMatch[1]) : null
    const alt = parsedAlt !== null && Number.isFinite(parsedAlt) ? parsedAlt : null

    const hdopMatch = inner.match(hdopRegex)
    const parsedHdop = hdopMatch ? parseFloat(hdopMatch[1]) : 5
    const accuracy = Number.isFinite(parsedHdop) && parsedHdop > 0 ? parsedHdop : 5

    const timeMatch = inner.match(timeRegex)
    let timestamp = baseFallbackTime + index * 1000
    if (timeMatch) {
      const parsedTs = Date.parse(timeMatch[1])
      if (Number.isFinite(parsedTs)) {
        timestamp = parsedTs
      }
    }

    rawPoints.push({ lat, lng, alt, accuracy, timestamp })
    index += 1
  }

  if (rawPoints.length === 0) {
    throw new Error('Nenhuma coordenada válida (<trkpt>) encontrada no arquivo GPX.')
  }

  // Sort strictly ascending and ensure unique timestamps for the composite key ['tripId', 'timestamp']
  rawPoints.sort((a, b) => a.timestamp - b.timestamp)
  const points: TrackPoint[] = []
  let lastTimestamp = -1

  for (const pt of rawPoints) {
    const uniqueTimestamp = pt.timestamp <= lastTimestamp ? lastTimestamp + 1 : pt.timestamp
    lastTimestamp = uniqueTimestamp
    points.push({
      tripId,
      timestamp: uniqueTimestamp,
      lat: pt.lat,
      lng: pt.lng,
      alt: pt.alt,
      accuracy: pt.accuracy,
    })
  }

  // Compute total distance (km), active moving duration (ms), average speed, and max speed
  let totalDistanceMeters = 0
  let movingTimeMs = 0
  let maxSpeedKmh = 0
  let smoothedSpeed = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const distMeters = calculateHaversineDistanceMeters(
      { latitude: prev.lat, longitude: prev.lng },
      { latitude: curr.lat, longitude: curr.lng },
    )
    const dtMs = curr.timestamp - prev.timestamp
    const dtSec = dtMs / 1000

    totalDistanceMeters += distMeters

    if (dtMs > 0 && dtMs <= 15_000) {
      movingTimeMs += dtMs
    }

    if (dtSec >= 0.5) {
      const instantKmh = mpsToKmh(distMeters / dtSec)
      if (instantKmh <= 125) {
        smoothedSpeed = applyEMA(instantKmh, smoothedSpeed, 0.45)
        if (smoothedSpeed > maxSpeedKmh) {
          maxSpeedKmh = smoothedSpeed
        }
      }
    }
  }

  const startTime = points[0].timestamp
  const endTime = points[points.length - 1].timestamp
  const totalDistanceKm = totalDistanceMeters / 1000
  const effectiveElapsedMs =
    movingTimeMs > 0 ? movingTimeMs : Math.max(0, endTime - startTime)
  const activeHours = effectiveElapsedMs / 3_600_000
  const averageSpeedKmh =
    activeHours > 0.0002 ? totalDistanceKm / activeHours : 0

  const trip: Trip = {
    id: tripId,
    startTime,
    endTime,
    totalDistance: totalDistanceKm,
    elapsedTimeMs: effectiveElapsedMs,
    averageSpeedKmh,
    maxSpeedKmh,
    isFinished: true,
  }

  return { trip, points }
}

/**
 * Parses a `.gpx` string and saves both the `Trip` metadata and all `TrackPoint` records
 * into IndexedDB (`bikedash_db`).
 */
export async function importGpxToDatabase(gpxContent: string): Promise<{
  trip: Trip
  pointCount: number
}> {
  const { trip, points } = parseGpxXml(gpxContent)
  await saveTrip(trip)
  await flushTrackPointsBatch(points)
  return {
    trip,
    pointCount: points.length,
  }
}

