import { useMemo, useState } from 'react'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { EMPTY_FILTERS, isFilterEmpty } from '@/components/filters/filterState'
import type { FilterState } from '@/components/filters/filterState'
import { HighlightCards } from '@/components/layout/HighlightCards'
import { PersonList } from '@/components/people/PersonList'
import { RecordDetail } from '@/components/detail/RecordDetail'
import { TimelineFeed } from '@/components/timeline/TimelineFeed'
import { useCaseData } from '@/hooks/useCaseData'
import { useToast } from '@/hooks/useToast'
import type { CaseRecord, InvestigationModel } from '@/types/domain'

function applyFilters(
  records: ReadonlyArray<CaseRecord>,
  filters: FilterState,
  selectedPersonId: string | null,
): CaseRecord[] {
  return records.filter((record) => {
    if (filters.sources.size > 0 && !filters.sources.has(record.sourceId)) return false
    if (filters.location !== null && record.location !== filters.location) return false
    if (filters.confidence !== null) {
      const dominantTone = record.flags[0]?.tone ?? null
      if (dominantTone !== filters.confidence) return false
    }
    if (selectedPersonId !== null && !record.personIds.includes(selectedPersonId)) return false
    return true
  })
}

interface DashboardLoadedProps {
  model: InvestigationModel
}

function DashboardLoaded({ model }: DashboardLoadedProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const { notify } = useToast()

  const filteredRecords = useMemo(
    () => applyFilters(model.records, filters, selectedPersonId),
    [model.records, filters, selectedPersonId],
  )

  const selectedRecord = selectedRecordId ? model.recordsById.get(selectedRecordId) ?? null : null

  function handleSelectPerson(personId: string) {
    setSelectedPersonId((current) => {
      const next = current === personId ? null : personId
      const person = model.peopleById.get(personId)
      if (next !== null && person) {
        notify(`Filtered timeline to ${person.displayName}`, 'info')
        const firstRecord = model.records.find((record) => record.personIds.includes(personId))
        if (firstRecord) setSelectedRecordId(firstRecord.id)
      } else {
        notify('Cleared person filter', 'info')
      }
      return next
    })
  }

  function handleFiltersChange(next: FilterState) {
    const wasEmpty = isFilterEmpty(filters)
    const becomesEmpty = isFilterEmpty(next)
    setFilters(next)
    if (!wasEmpty && becomesEmpty) {
      notify('Filters cleared', 'info')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <HighlightCards
        highlights={model.highlights}
        onSelectPerson={handleSelectPerson}
        onSelectRecord={(recordId) => setSelectedRecordId(recordId)}
      />
      <div className="grid grid-cols-[var(--rail-width)_minmax(0,1fr)_minmax(0,420px)] flex-1 min-h-0">
        <div className="flex flex-col min-h-0 border-r border-border">
          <FilterPanel
            state={filters}
            locations={model.locations}
            totalRecords={model.records.length}
            filteredRecords={filteredRecords.length}
            onChange={handleFiltersChange}
          />
          <div className="flex-1 min-h-0 border-t border-border">
            <PersonList
              people={model.people}
              selectedPersonId={selectedPersonId}
              onSelect={handleSelectPerson}
            />
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <TimelineFeed
            records={filteredRecords}
            selectedRecordId={selectedRecordId}
            onSelect={setSelectedRecordId}
          />
        </div>
        <RecordDetail
          record={selectedRecord}
          recordsById={model.recordsById}
          peopleById={model.peopleById}
          onSelectRecord={setSelectedRecordId}
          onSelectPerson={handleSelectPerson}
        />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-border">
        <SkeletonStack count={1} rowHeight="120px" />
        <SkeletonStack count={1} rowHeight="120px" />
        <SkeletonStack count={1} rowHeight="120px" />
      </div>
      <div className="grid grid-cols-[var(--rail-width)_minmax(0,1fr)_minmax(0,420px)] flex-1 min-h-0">
        <div className="p-4 border-r border-border">
          <SkeletonStack count={6} rowHeight="36px" />
        </div>
        <div className="p-4">
          <SkeletonStack count={10} rowHeight="64px" />
        </div>
        <div className="p-4 border-l border-border">
          <SkeletonStack count={4} rowHeight="48px" />
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { status, model, error, reload } = useCaseData()

  if (status === 'loading') return <DashboardSkeleton />
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
  return <DashboardLoaded model={model} />
}
