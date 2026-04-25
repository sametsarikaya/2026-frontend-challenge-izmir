import { useCallback, useMemo } from 'react'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { isFilterEmpty } from '@/components/filters/filterState'
import type { FilterState } from '@/components/filters/filterState'
import { BreadcrumbNav } from '@/components/layout/BreadcrumbNav'
import { HighlightCards } from '@/components/layout/HighlightCards'
import { PersonList } from '@/components/people/PersonList'
import { RecordDetail } from '@/components/detail/RecordDetail'
import { SearchInput } from '@/components/search/SearchInput'
import { SearchResults } from '@/components/search/SearchResults'
import { TimelineFeed } from '@/components/timeline/TimelineFeed'
import { useCaseData } from '@/hooks/useCaseData'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useToast } from '@/hooks/useToast'
import { useUrlState } from '@/hooks/useUrlState'
import { searchAll } from '@/lib/fuzzySearch'
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
  const url = useUrlState()
  const { notify } = useToast()
  const { query, filters, selectedPersonId, selectedRecordId } = url

  const filteredRecords = useMemo(
    () => applyFilters(model.records, filters, selectedPersonId),
    [model.records, filters, selectedPersonId],
  )

  const trimmedQuery = query.trim()
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null
    return searchAll(trimmedQuery, filteredRecords, model.people)
  }, [trimmedQuery, filteredRecords, model.people])

  const selectedRecord = selectedRecordId ? model.recordsById.get(selectedRecordId) ?? null : null
  const selectedPerson = selectedPersonId ? model.peopleById.get(selectedPersonId) ?? null : null

  const navigableIds = useMemo(
    () => (searchResults ? [] : filteredRecords.map((record) => record.id)),
    [searchResults, filteredRecords],
  )

  const handleSelectRecord = useCallback(
    (recordId: string | null) => {
      url.setSelectedRecord(recordId)
    },
    [url],
  )

  const handleSelectPerson = useCallback(
    (personId: string) => {
      const isSame = url.selectedPersonId === personId
      const next = isSame ? null : personId
      url.setSelectedPerson(next)
      if (next !== null) {
        const person = model.peopleById.get(personId)
        if (person) notify(`Filtered timeline to ${person.displayName}`, 'info')
        const firstRecord = model.records.find((record) => record.personIds.includes(personId))
        if (firstRecord) url.setSelectedRecord(firstRecord.id)
      } else {
        notify('Cleared person filter', 'info')
      }
    },
    [model.peopleById, model.records, notify, url],
  )

  const handleFiltersChange = useCallback(
    (next: FilterState) => {
      const wasEmpty = isFilterEmpty(filters)
      const becomesEmpty = isFilterEmpty(next)
      url.setFilters(next)
      if (!wasEmpty && becomesEmpty) {
        notify('Filters cleared', 'info')
      }
    },
    [filters, notify, url],
  )

  useKeyboardNav({
    itemIds: navigableIds,
    selectedId: selectedRecordId,
    onSelect: handleSelectRecord,
    onEscape: () => {
      if (selectedRecordId) handleSelectRecord(null)
      else if (selectedPersonId) url.setSelectedPerson(null)
    },
    enabled: searchResults === null,
  })

  const breadcrumbItems = useMemo(() => {
    if (!selectedRecord) return []
    const items = [
      { label: 'Dashboard', onClick: () => url.resetAll() },
      { label: selectedRecord.sourceLabel },
    ]
    items.push({ label: selectedRecord.title })
    return items
  }, [selectedRecord, url])

  return (
    <div className="flex flex-col h-full min-h-0">
      <HighlightCards
        highlights={model.highlights}
        onSelectPerson={(personId) => handleSelectPerson(personId)}
        onSelectRecord={(recordId) => handleSelectRecord(recordId)}
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
          <div className="px-5 py-3 border-b border-border bg-surface-raised">
            <SearchInput
              query={query}
              resultCount={
                searchResults
                  ? searchResults.records.length + searchResults.people.length
                  : null
              }
              onChange={(next) => url.setQuery(next)}
            />
            {selectedPerson && !searchResults ? (
              <div className="meta-mono mt-2 flex items-center justify-between gap-3">
                <span>
                  Person filter · <span className="text-accent-ink">{selectedPerson.displayName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPerson(selectedPerson.id)}
                  className="text-accent hover:text-accent-ink uppercase tracking-wider underline-offset-4 hover:underline"
                >
                  clear
                </button>
              </div>
            ) : null}
          </div>
          {selectedRecord && !searchResults ? (
            <BreadcrumbNav items={breadcrumbItems} />
          ) : null}
          <div className="flex-1 min-h-0">
            {searchResults ? (
              <SearchResults
                results={searchResults}
                onSelectRecord={(recordId) => {
                  handleSelectRecord(recordId)
                  url.setQuery('')
                }}
                onSelectPerson={(personId) => {
                  handleSelectPerson(personId)
                  url.setQuery('')
                }}
              />
            ) : (
              <TimelineFeed
                records={filteredRecords}
                selectedRecordId={selectedRecordId}
                onSelect={handleSelectRecord}
              />
            )}
          </div>
        </div>
        <RecordDetail
          record={selectedRecord}
          recordsById={model.recordsById}
          peopleById={model.peopleById}
          onSelectRecord={handleSelectRecord}
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
