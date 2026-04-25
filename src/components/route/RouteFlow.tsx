import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import type { RouteStop } from '@/lib/routeReconstruction'
import type { LatLngExpression } from 'leaflet'
import { numberedIcon } from '@/components/map/markerIcons'
import 'leaflet/dist/leaflet.css'

interface RouteFlowProps {
  stops: RouteStop[]
  activeStopIndex: number | null
}

function FitBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap()
  useEffect(() => {
    // Fix Leaflet tile rendering when container resizes
    const timer = setTimeout(() => map.invalidateSize(), 200)
    if (positions.length > 1) {
      const bounds = positions.map((p) => p as [number, number])
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else if (positions.length === 1) {
      const [lat, lng] = positions[0] as [number, number]
      map.setView([lat, lng], 14)
    }
    return () => clearTimeout(timer)
  }, [map, positions])
  return null
}

export function RouteFlow({ stops, activeStopIndex }: RouteFlowProps) {
  const geoStops = stops
    .map((stop, i) => ({ stop, index: i }))
    .filter(({ stop }) => stop.geo !== null)

  const positions: LatLngExpression[] = geoStops.map(
    ({ stop }) => [stop.geo!.lat, stop.geo!.lng] as [number, number],
  )

  return (
    <MapContainer
      center={[38.42, 27.14]}
      zoom={12}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      className="case-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={positions} />

      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: 'oklch(46% 0.165 28)',
            weight: 3,
            dashArray: '8 6',
            opacity: 0.75,
          }}
        />
      )}

      {geoStops.map(({ stop, index }) => (
        <Marker
          key={`stop-${index}`}
          position={[stop.geo!.lat, stop.geo!.lng]}
          icon={numberedIcon(index + 1, activeStopIndex === index)}
        >
          <Popup className="case-popup" maxWidth={280}>
            <div className="flex flex-col gap-1">
              <span className="meta-mono text-accent-ink font-bold">Stop {index + 1}</span>
              <span className="text-sm font-medium text-ink">{stop.location}</span>
              <span className="meta-mono">
                {stop.records.length} record{stop.records.length === 1 ? '' : 's'} · {stop.durationLabel}
              </span>
              {stop.peoplePresent.length > 0 && (
                <span className="meta-mono text-ink-muted">
                  {stop.peoplePresent.join(', ')}
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
