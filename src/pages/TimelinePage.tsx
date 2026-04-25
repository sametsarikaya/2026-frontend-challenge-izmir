import { useMemo, useState } from 'react'
import { useCaseData } from '@/hooks/useCaseData'
import { useUrlState } from '@/hooks/useUrlState'
import { RecordDetail } from '@/components/detail/RecordDetail'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { EmptyState } from '@/components/feedback/EmptyState'
import { normalizeText } from '@/lib/textNormalize'
import type { CaseRecord, InvestigationModel, Person, SourceId } from '@/types/domain'

const PODO_KEY = normalizeText('Podo')

const SOURCE_FILTERS: { id: SourceId | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'checkins', label: 'Checkins' },
  { id: 'messages', label: 'Messages' },
  { id: 'sightings', label: 'Sightings' },
  { id: 'notes', label: 'Notes' },
  { id: 'tips', label: 'Tips' },
]

function findPodo(model: InvestigationModel): Person | null {
  return model.people.find((p) => normalizeText(p.displayName) === PODO_KEY) ?? null
}

function TimelineLoaded({ model }: { model: InvestigationModel }) {
  const url = useUrlState()
  const [activeFilter, setActiveFilter] = useState<SourceId | 'all'>('all')
  const selectedRecordId = url.selectedRecordId
  const selectedRecord = selectedRecordId
    ? model.recordsById.get(selectedRecordId) ?? null
    : null

  const podo = findPodo(model)

  const allEvents = useMemo(() => {
    if (!podo) return []
    return podo.recordIds
      .map((id) => model.recordsById.get(id))
      .filter((r): r is CaseRecord => r !== undefined && r.sortTime > 0)
      .sort((a, b) => a.sortTime - b.sortTime)
  }, [podo, model])

  const events = useMemo(() => {
    if (activeFilter === 'all') return allEvents
    return allEvents.filter((e) => e.sourceId === activeFilter)
  }, [allEvents, activeFilter])

  // count per source for chip badges
  const sourceCounts = useMemo(() => {
    const counts = new Map<SourceId, number>()
    for (const e of allEvents) {
      counts.set(e.sourceId, (counts.get(e.sourceId) ?? 0) + 1)
    }
    return counts
  }, [allEvents])

  if (!podo || allEvents.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No Podo data found"
          description="Could not find records related to Podo in the loaded data."
        />
      </div>
    )
  }

  const lastEvent = allEvents[allEvents.length - 1]

  return (
    <div className="h-full flex min-h-0">
      {/* timeline column */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-6">
          <header className="mb-6">
            <h1 className="display-serif text-2xl text-ink">Podo&rsquo;s Timeline</h1>
            <p className="meta-mono mt-1">{allEvents.length} events &middot; chronological order</p>
          </header>

          {/* source filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {SOURCE_FILTERS.map(({ id, label }) => {
              const count = id === 'all' ? allEvents.length : (sourceCounts.get(id as SourceId) ?? 0)
              if (id !== 'all' && count === 0) return null
              const isActive = activeFilter === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveFilter(id)}
                  className={[
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                    isActive
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-border bg-surface-raised text-ink-muted hover:text-ink hover:bg-surface',
                  ].join(' ')}
                >
                  {label}
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          {/* summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="p-3 border border-border rounded bg-surface-raised">
              <span className="meta-mono block mb-1">Last Seen</span>
              <span className="text-sm font-semibold text-ink">{lastEvent.timeLabel}</span>
              <span className="meta-mono block">{lastEvent.location}</span>
            </div>
            <div className="p-3 border border-border rounded bg-surface-raised">
              <span className="meta-mono block mb-1">Locations</span>
              <span className="text-sm font-semibold text-ink">{podo.locations.length}</span>
            </div>
            <div className="p-3 border border-border rounded bg-surface-raised">
              <span className="meta-mono block mb-1">Records</span>
              <span className="text-sm font-semibold text-ink">{allEvents.length}</span>
            </div>
          </div>

          {/* filtered count notice */}
          {activeFilter !== 'all' && (
            <p className="meta-mono mb-4">
              Showing {events.length} of {allEvents.length} &mdash;{' '}
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="text-accent-ink underline underline-offset-2 cursor-pointer"
              >
                clear filter
              </button>
            </p>
          )}

          {/* vertical timeline */}
          <ol className="relative border-l-2 border-border ml-3">
            {events.map((event, i) => {
              const isLast = i === events.length - 1 && activeFilter === 'all'
              const isSelected = event.id === selectedRecordId
              return (
                <li key={event.id} className="mb-6 ml-6">
                  <span
                    className={[
                      'absolute -left-[9px] w-4 h-4 rounded-full border-2',
                      isLast
                        ? 'bg-accent border-accent'
                        : isSelected
                          ? 'bg-accent-soft border-accent'
                          : 'bg-surface border-border',
                    ].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => url.setSelectedRecord(event.id === selectedRecordId ? null : event.id)}
                    className={[
                      'w-full text-left p-3 rounded border transition-colors cursor-pointer',
                      isSelected
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface-raised hover:bg-surface',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="case-stamp">{event.sourceLabel}</span>
                      <time className="meta-mono">{event.timeLabel}</time>
                      {event.flags.map((f) => (
                        <span
                          key={f.label}
                          className={[
                            'text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded',
                            f.tone === 'high'
                              ? 'bg-accent text-white'
                              : f.tone === 'medium'
                                ? 'bg-warning text-ink'
                                : 'bg-surface text-ink-muted',
                          ].join(' ')}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-medium text-ink">{event.title}</p>
                    <p className="meta-mono">{event.location}</p>
                    {event.content && (
                      <p className="text-xs text-ink-muted mt-1 line-clamp-2">{event.content}</p>
                    )}
                  </button>
                </li>
              )
            })}

            {/* MISSING marker — only when showing all */}
            {activeFilter === 'all' && (
              <li className="mb-6 ml-6">
                <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-accent border-2 border-accent animate-pulse" />
                <div className="p-3 rounded border border-accent bg-accent-soft">
                  <span className="meta-mono text-accent-ink font-bold">??? -- MISSING</span>
                  <p className="text-sm text-ink-muted mt-1">
                    Podo was not seen after this point. The investigation continues.
                  </p>
                </div>
              </li>
            )}
          </ol>
        </div>
      </div>

      {/* detail panel */}
      {selectedRecord && (
        <div className="w-[420px] shrink-0 overflow-y-auto border-l border-border">
          <RecordDetail
            record={selectedRecord}
            recordsById={model.recordsById}
            peopleById={model.peopleById}
            onSelectRecord={(id) => url.setSelectedRecord(id)}
            onSelectPerson={(id) => url.setSelectedPerson(id)}
          />
        </div>
      )}
    </div>
  )
}

export function TimelinePage() {
  const { status, model, error, reload } = useCaseData()

  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <SkeletonStack count={10} rowHeight="72px" />
      </div>
    )
  }
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
  return <TimelineLoaded model={model} />
}
