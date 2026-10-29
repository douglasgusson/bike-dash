import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import type { LatLngTuple } from '../domain/geometry'

interface MapAutoFitterProps {
  coordinates: LatLngTuple[]
}

/**
 * Functional child of `<MapContainer>` with no visual rendering (`return null`).
 * Computes the `LatLngBounds` of the entire simplified route and applies
 * `map.fitBounds(bounds, { padding: [30, 30] })` to frame the trip automatically.
 */
export function MapAutoFitter({ coordinates }: MapAutoFitterProps) {
  const map = useMap()

  useEffect(() => {
    if (coordinates.length === 0) return

    // Ensure Leaflet recalculates container size when mounted inside a modal/flex layout
    map.invalidateSize()

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 16)
      return
    }

    const bounds = L.latLngBounds(coordinates)
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [map, coordinates])

  return null
}

