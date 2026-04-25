import { useCallback, useMemo, useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { RecordDetail } from '@/components/detail/RecordDetail'
import { RouteFlow } from '@/components/route/RouteFlow'
import { RouteStopCard } from '@/components/route/RouteStop'
import { useCaseData } from '@/hooks/useCaseData'
import { useUrlState } from '@/hooks/useUrlState'
import { reconstructRoute } from '@/lib/routeReconstruction'
import { normalizeText } from '@/lib/textNormalize'
import type { CaseRecord, InvestigationModel, Person } from '@/types/domain'

const PODO_KEY = normalizeText('Podo')

function findPodo(people: readonly Person[]): Person | null {
  return people.find((p) => normalizeText(p.displayName) === PODO_KEY) ?? null
}

interface RouteLoadedProps {
  model: InvestigationModel
}

function RouteLoaded({ model }: RouteLoadedProps) {
  const url = useUrlState()
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null)

  // Person selector — default to Podo
  const podo = findPodo(model.people)
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    podo?.id ?? model.people[0]?.id ?? '',
  )

  const selectedPerson = model.peopleById.get(selectedPersonId) ?? null

  const stops = useMemo(() => {
    if (!selectedPerson) return []
    return reconstructRoute(selectedPerson, model)
  }, [selectedPerson, model])

  // Records without geo (for sidebar warning)
  const noGeoRecords = useMemo(() => {
    if (!selectedPerson) return []
    return selectedPerson.recordIds
      .map((id) => model.recordsById.get(id))
      .filter((r): r is CaseRecord => r !== undefined && r.sortTime > 0 && r.geo === null)
      .sort((a, b) => a.sortTime - b.sortTime)
  }, [selectedPerson, model])

  const selectedRecordId = url.selectedRecordId
  const selectedRecord = selectedRecordId
    ? model.recordsById.get(selectedRecordId) ?? null
    : null

  const handleSelectRecord = useCallback(
    (id: string | null) => url.setSelectedRecord(id),
    [url],
  )

  if (!selectedPerson) {
    return (
      <div className="p-8 max-w-3xl">
        <EmptyState
          title="No people found"
          description="The identity resolver could not find any people in the data."
        />
      </div>
    )
  }

  const geoStopCount = stops.filter((s) => s.geo !== null).length
  const totalRecords = stops.reduce((sum, s) => sum + s.records.length, 0)

  return (
    <div className="h-full flex min-h-0">
      {/* sidebar — person selector + stop list */}
      <div className="w-[380px] shrink-0 border-r border-border overflow-y-auto bg-bg">
        <div className="px-5 py-4 border-b border-border bg-surface-raised">
          <span className="case-stamp">route flow</span>

          {/* person selector */}
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="mt-2 w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-ink font-medium cursor-pointer"
          >
            {model.people
              .filter((p) => p.recordIds.length >= 2)
              .sort((a, b) => b.recordIds.length - a.recordIds.length)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.recordIds.length} records)
                </option>
              ))}
          </select>

          {stops.length > 0 && (
            <p className="meta-mono mt-2">
              {stops.length} stop{stops.length === 1 ? '' : 's'} &middot; {totalRecords} record{totalRecords === 1 ? '' : 's'}
              {geoStopCount < stops.length && (
                <span className="text-warning"> &middot; {stops.length - geoStopCount} without geo</span>
              )}
            </p>
          )}
        </div>

        <div className="px-4 py-5">
          {stops.map((stop, i) => (
            <div
              key={`${stop.location}-${stop.firstTime}`}
              onMouseEnter={() => setActiveStopIndex(i)}
              onMouseLeave={() => setActiveStopIndex(null)}
            >
              <RouteStopCard
                stop={stop}
                index={i}
                isLast={i === stops.length - 1}
                onSelectRecord={(id) => handleSelectRecord(id)}
              />
            </div>
          ))}

          {stops.length === 0 && (
            <EmptyState
              title="No route data"
              description={`${selectedPerson.displayName} has no records with timestamps for route reconstruction.`}
            />
          )}

          {/* records without geo — warning section */}
          {noGeoRecords.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="meta-mono text-warning mb-3">
                {noGeoRecords.length} record{noGeoRecords.length === 1 ? '' : 's'} without location (not on map)
              </p>
              {noGeoRecords.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleSelectRecord(rec.id)}
                  className={[
                    'w-full text-left flex items-start gap-2 px-3 py-2 mb-1 rounded border transition-colors cursor-pointer',
                    rec.id === selectedRecordId
                      ? 'border-accent bg-accent-soft'
                      : 'border-border/50 bg-surface hover:bg-surface-raised',
                  ].join(' ')}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-ink truncate block">{rec.title}</span>
                    <span className="meta-mono">{rec.timeLabel}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* map */}
      <div className="flex-1 min-w-0 h-full relative">
        <RouteFlow stops={stops} activeStopIndex={activeStopIndex} />
      </div>

      {/* detail panel */}
      {selectedRecord && (
        <div className="w-[420px] shrink-0 overflow-y-auto border-l border-border">
          <RecordDetail
            record={selectedRecord}
            recordsById={model.recordsById}
            peopleById={model.peopleById}
            onSelectRecord={handleSelectRecord}
            onSelectPerson={(id) => url.setSelectedPerson(id)}
          />
        </div>
      )}
    </div>
  )
}

function RouteSkeleton() {
  return (
    <div className="h-full flex min-h-0">
      <div className="w-[380px] shrink-0 border-r border-border p-4">
        <SkeletonStack count={6} rowHeight="80px" />
      </div>
      <div className="flex-1 bg-surface animate-pulse" />
    </div>
  )
}

export function RoutePage() {
  const { status, model, error, reload } = useCaseData()

  if (status === 'loading') return <RouteSkeleton />
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
  return <RouteLoaded model={model} />
}
