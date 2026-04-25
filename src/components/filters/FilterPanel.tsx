import type { ConfidenceTone, SourceId } from '@/types/domain'
import type { FilterState } from './filterState'

interface FilterPanelProps {
  state: FilterState
  locations: ReadonlyArray<string>
  totalRecords: number
  filteredRecords: number
  onChange: (next: FilterState) => void
}

interface SourceOption {
  id: SourceId
  label: string
}

const SOURCE_OPTIONS: ReadonlyArray<SourceOption> = [
  { id: 'checkins', label: 'Check-ins' },
  { id: 'messages', label: 'Messages' },
  { id: 'sightings', label: 'Sightings' },
  { id: 'notes', label: 'Notes' },
  { id: 'tips', label: 'Tips' },
]

const CONFIDENCE_OPTIONS: ReadonlyArray<{ value: ConfidenceTone; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function FilterPanel({
  state,
  locations,
  totalRecords,
  filteredRecords,
  onChange,
}: FilterPanelProps) {
  const isFiltered =
    state.sources.size > 0 || state.location !== null || state.confidence !== null

  function toggleSource(id: SourceId) {
    const next = new Set(state.sources)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange({ ...state, sources: next })
  }

  function reset() {
    onChange({ sources: new Set(), location: null, confidence: null })
  }

  return (
    <aside className="flex flex-col gap-6 p-5 border-r border-border bg-surface min-h-0 overflow-y-auto">
      <header className="flex items-baseline justify-between gap-2">
        <span className="case-stamp">filters</span>
        <span className="meta-mono">
          {filteredRecords} / {totalRecords}
        </span>
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="meta-mono uppercase tracking-wider">Source</h3>
        <ul className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map((option) => {
            const active = state.sources.has(option.id)
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => toggleSource(option.id)}
                  aria-pressed={active}
                  className={[
                    'px-3 py-1.5 text-xs border rounded-sm transition-colors',
                    active
                      ? 'bg-accent-soft border-accent text-accent-ink'
                      : 'bg-bg border-border text-ink-muted hover:text-ink hover:border-border-strong',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <label className="meta-mono uppercase tracking-wider" htmlFor="filter-location">
          Location
        </label>
        <select
          id="filter-location"
          value={state.location ?? ''}
          onChange={(event) =>
            onChange({ ...state, location: event.target.value === '' ? null : event.target.value })
          }
          className="bg-bg border border-border rounded-sm px-2.5 py-2 text-sm text-ink hover:border-border-strong focus-visible:border-accent"
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="meta-mono uppercase tracking-wider">Confidence</h3>
        <ul className="flex gap-1.5">
          {CONFIDENCE_OPTIONS.map((option) => {
            const active = state.confidence === option.value
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...state, confidence: active ? null : option.value })
                  }
                  aria-pressed={active}
                  className={[
                    'px-3 py-1.5 text-xs border rounded-sm transition-colors',
                    active
                      ? 'bg-accent-soft border-accent text-accent-ink'
                      : 'bg-bg border-border text-ink-muted hover:text-ink hover:border-border-strong',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {isFiltered ? (
        <button
          type="button"
          onClick={reset}
          className="meta-mono uppercase tracking-wider text-accent self-start hover:text-accent-ink underline underline-offset-4"
        >
          Reset filters
        </button>
      ) : null}
    </aside>
  )
}
