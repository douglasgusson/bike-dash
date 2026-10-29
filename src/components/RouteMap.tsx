import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import { mapConfig } from '../config/env'
import type { LatLngTuple } from '../domain/geometry'
import { MapAutoFitter } from './MapAutoFitter'

export type RouteLineColor = 'cyan' | 'orange'

interface RouteMapProps {
  coordinates: LatLngTuple[]
  lineColor?: RouteLineColor
}

/**
 * Encapsulates `<MapContainer>`, `<TileLayer>`, `<Polyline>`, and `<MapAutoFitter>`.
 * Receives only the Douglas-Peucker simplified coordinates `[[lat, lng], ...]`.
 * Uses a solid `#1a1a1a` background so the high-contrast route polyline remains clearly
 * visible even when offline without cached street tiles.
 */
export function RouteMap({ coordinates, lineColor = 'cyan' }: RouteMapProps) {
  if (coordinates.length === 0) return null

  const startPoint = coordinates[0]
  const endPoint = coordinates[coordinates.length - 1]
  const strokeHex = lineColor === 'orange' ? '#ff5f1f' : '#00f0ff'

  return (
    <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden border-2 border-neutral-800 bg-[#1a1a1a]">
      <MapContainer
        center={startPoint}
        zoom={14}
        doubleClickZoom={false}
        touchZoom={true}
        scrollWheelZoom={true}
        zoomControl={true}
        className="w-full h-full bg-[#1a1a1a]"
      >
        <TileLayer
          url={mapConfig.tileUrl}
          attribution={mapConfig.attribution}
          tileSize={256}
          maxZoom={mapConfig.maxZoom}
        />

        <Polyline
          positions={coordinates}
          pathOptions={{
            color: strokeHex,
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
          }}
        />

        {/* Start Marker (Green) */}
        <CircleMarker
          center={startPoint}
          radius={6}
          pathOptions={{
            color: '#000000',
            weight: 2,
            fillColor: '#22c55e',
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            Início
          </Tooltip>
        </CircleMarker>

        {/* Finish Marker (Checkered / Red-Orange) */}
        {coordinates.length > 1 && (
          <CircleMarker
            center={endPoint}
            radius={6}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: '#ef4444',
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              Chegada
            </Tooltip>
          </CircleMarker>
        )}

        <MapAutoFitter coordinates={coordinates} />
      </MapContainer>
    </div>
  )
}

