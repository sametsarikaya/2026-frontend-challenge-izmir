import { useCallback, useEffect, useRef } from 'react'
import { CaseMap } from '@/components/map/CaseMap'
import { RecordDetail } from '@/components/detail/RecordDetail'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { useCaseData } from '@/hooks/useCaseData'
import { useUrlState } from '@/hooks/useUrlState'
import type { CaseRecord, InvestigationModel, SourceId } from '@/types/domain'
import { useMemo } from 'react'

const SOURCE_DOT: Record<SourceId, string> = {
  checkins: 'bg-ink-muted',
  messages: 'bg-ink-muted',
  sightings: 'bg-accent',
  notes: 'bg-ink-subtle',
  tips: 'bg-warning',
}

interface MapLoadedProps {
  model: InvestigationModel
}

function MapLoaded({ model }: MapLoadedProps) {
  const url = useUrlState()
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRecordId = url.selectedRecordId

  const geoRecords = useMemo(
    () => model.records.filter((r) => r.geo !== null),
    [model.records],
  )

  const selectedRecord = selectedRecordId
    ? model.recordsById.get(selectedRecordId) ?? null
    : null

  const handleSelect = useCallback(
    (id: string | null) => {
      url.setSelectedRecord(id === selectedRecordId ? null : id)
    },
    [selectedRecordId, url],
  )

  const handleSelectPerson = useCallback(
    (personId: string) => {
      url.setSelectedPerson(personId)
    },
    [url],
  )

  // scroll sidebar item into view
  useEffect(() => {
    if (!selectedRecordId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-record-id="${selectedRecordId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedRecordId])

  return (
    <div className="h-full flex min-h-0">
      {/* sidebar list */}
      <div
        ref={listRef}
        className="w-[340px] shrink-0 border-r border-border overflow-y-auto bg-bg"
      >
        <div className="px-5 py-4 border-b border-border bg-surface-raised">
          <span className="case-stamp">map view</span>
          <p className="meta-mono mt-2">
            {geoRecords.length} location-tagged record{geoRecords.length === 1 ? '' : 's'}
          </p>
        </div>
        {geoRecords.map((record) => (
          <MapSidebarItem
            key={record.id}
            record={record}
            active={record.id === selectedRecordId}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* map — flex-1 fills remaining width, h-full fills parent height */}
      <div className="flex-1 min-w-0 h-full relative">
        <CaseMap
          records={geoRecords}
          selectedRecordId={selectedRecordId}
          onSelect={(id) => handleSelect(id)}
        />
      </div>

      {/* detail panel */}
      {selectedRecord && (
        <div className="w-[420px] shrink-0 overflow-y-auto border-l border-border">
          <RecordDetail
            record={selectedRecord}
            recordsById={model.recordsById}
            peopleById={model.peopleById}
            onSelectRecord={handleSelect}
            onSelectPerson={handleSelectPerson}
          />
        </div>
      )}
    </div>
  )
}

interface MapSidebarItemProps {
  record: CaseRecord
  active: boolean
  onSelect: (id: string) => void
}

function MapSidebarItem({ record, active, onSelect }: MapSidebarItemProps) {
  return (
    <button
      type="button"
      data-record-id={record.id}
      onClick={() => onSelect(record.id)}
      className={[
        'w-full text-left flex items-start gap-2.5 px-5 py-3 border-b border-border transition-colors cursor-pointer',
        active ? 'bg-accent-soft' : 'hover:bg-surface',
      ].join(' ')}
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${SOURCE_DOT[record.sourceId]}`} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-ink truncate">{record.title}</span>
        <span className="meta-mono truncate">{record.location}</span>
        <span className="meta-mono text-ink-subtle">{record.timeLabel}</span>
      </div>
    </button>
  )
}

function MapSkeleton() {
  return (
    <div className="h-full flex min-h-0">
      <div className="w-[340px] shrink-0 border-r border-border p-4">
        <SkeletonStack count={8} rowHeight="56px" />
      </div>
      <div className="flex-1 bg-surface animate-pulse" />
    </div>
  )
}

export function MapPage() {
  const { status, model, error, reload } = useCaseData()

  if (status === 'loading') return <MapSkeleton />
  if (status === 'error' || !model) {
    return (
      <div className="p-8">
        <ErrorCard
          title="Could not load case records"
          message={error ?? 'Unknown error reaching Jotform.'}
          onRetry={reload}
        />
      </div>
    )
  }
  return <MapLoaded model={model} />
}
