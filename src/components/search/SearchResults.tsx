import type { SearchResultsByGroup } from '@/lib/fuzzySearch'
import { EmptyState } from '@/components/feedback/EmptyState'

interface SearchResultsProps {
  results: SearchResultsByGroup
  onSelectRecord: (recordId: string) => void
  onSelectPerson: (personId: string) => void
}

export function SearchResults({ results, onSelectRecord, onSelectPerson }: SearchResultsProps) {
  const hasRecords = results.records.length > 0
  const hasPeople = results.people.length > 0

  if (!hasRecords && !hasPeople) {
    return (
      <div className="p-6">
        <EmptyState
          title={`No matches for “${results.query}”`}
          description="Try a shorter token, a different spelling, or clear the query."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-5 overflow-y-auto h-full min-h-0">
      {hasRecords ? (
        <section className="flex flex-col gap-2">
          <header className="flex items-baseline justify-between gap-2">
            <span className="case-stamp">records</span>
            <span className="meta-mono">{results.records.length}</span>
          </header>
          <ul className="flex flex-col">
            {results.records.map(({ record }) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => onSelectRecord(record.id)}
                  className="w-full text-left flex flex-col gap-1 py-2 border-b border-border hover:bg-surface"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink truncate">{record.title}</span>
                    <span className="meta-mono shrink-0">{record.timeLabel}</span>
                  </span>
                  <span className="meta-mono truncate">
                    {record.sourceLabel} · {record.location}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasPeople ? (
        <section className="flex flex-col gap-2">
          <header className="flex items-baseline justify-between gap-2">
            <span className="case-stamp">people</span>
            <span className="meta-mono">{results.people.length}</span>
          </header>
          <ul className="flex flex-col">
            {results.people.map(({ person }) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onSelectPerson(person.id)}
                  className="w-full text-left flex items-center justify-between gap-3 py-2 border-b border-border hover:bg-surface"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-ink truncate">{person.displayName}</span>
                    <span className="meta-mono truncate">
                      {person.aliases.length} alias{person.aliases.length === 1 ? '' : 'es'} ·{' '}
                      {person.recordCount} records
                    </span>
                  </span>
                  <span className="meta-mono shrink-0">score {person.suspicionScore}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
