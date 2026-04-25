import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { CaseRecord } from '@/types/domain'
import { defaultIcon, selectedIcon } from './markerIcons'
import 'leaflet/dist/leaflet.css'

interface CaseMapProps {
  records: CaseRecord[]
  selectedRecordId: string | null
  onSelect: (id: string) => void
}

/**
 * Inner map controller.
 * - On mount: invalidateSize + fitBounds to all markers
 * - On selectedRecordId change: flyTo that marker
 */
function Controller({
  records,
  selectedRecordId,
}: {
  records: CaseRecord[]
  selectedRecordId: string | null
}) {
  const map = useMap()
  const hasFitted = useRef(false)

  // 1. Fix tile rendering
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize()

      // 2. Fit bounds once after invalidateSize
      if (!hasFitted.current && records.length > 0) {
        hasFitted.current = true
        const group = L.featureGroup(
          records.map((r) => L.marker([r.geo!.lat, r.geo!.lng])),
        )
        map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 })
      }
    }, 300)
    return () => window.clearTimeout(id)
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3. Fly to selected record
  useEffect(() => {
    if (!selectedRecordId) return
    const rec = records.find((r) => r.id === selectedRecordId)
    if (rec?.geo) {
      map.flyTo([rec.geo.lat, rec.geo.lng], 15, { duration: 0.5 })
    }
  }, [selectedRecordId, records, map])

  return null
}

export function CaseMap({ records, selectedRecordId, onSelect }: CaseMapProps) {
  return (
    <MapContainer
      center={[38.42, 27.14]}
      zoom={13}
      scrollWheelZoom
      className="case-map"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Controller records={records} selectedRecordId={selectedRecordId} />
      {records.map((record) => (
        <Marker
          key={record.id}
          position={[record.geo!.lat, record.geo!.lng]}
          icon={record.id === selectedRecordId ? selectedIcon : defaultIcon}
          eventHandlers={{ click: () => onSelect(record.id) }}
        >
          <Popup className="case-popup" maxWidth={280}>
            <div className="flex flex-col gap-1">
              <span className="case-stamp">{record.sourceLabel}</span>
              <span className="text-sm font-medium text-ink">{record.title}</span>
              <span className="meta-mono">{record.location}</span>
              {record.timestamp && (
                <time className="meta-mono" dateTime={record.timestamp.toISOString()}>
                  {record.timestampLabel}
                </time>
              )}
            </div>
          </Popup>
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
            <span className="text-xs font-medium">{record.title}</span>
            {record.timeLabel && <span className="text-[10px] text-gray-500 ml-1">{record.timeLabel}</span>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
