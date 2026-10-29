import type { TrackPoint, Trip } from '../domain/types'
import { getTrackPointsByTripId, getTripById } from './TripDatabase'

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

