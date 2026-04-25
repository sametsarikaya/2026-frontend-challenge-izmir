import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FilterState } from '@/components/filters/filterState'
import type { ConfidenceTone, SourceId } from '@/types/domain'

const VALID_SOURCES: ReadonlySet<SourceId> = new Set([
  'checkins',
  'messages',
  'sightings',
  'notes',
  'tips',
])
const VALID_CONFIDENCE: ReadonlySet<ConfidenceTone> = new Set(['high', 'medium', 'low'])

export interface UrlStateValue {
  query: string
  filters: FilterState
  selectedRecordId: string | null
  selectedPersonId: string | null
}

export interface UrlStateActions {
  setQuery: (query: string) => void
  setFilters: (filters: FilterState) => void
  setSelectedRecord: (recordId: string | null) => void
  setSelectedPerson: (personId: string | null) => void
  resetAll: () => void
}

function parseSources(raw: string | null): ReadonlySet<SourceId> {
  if (!raw) return new Set()
  const tokens = raw.split(',').map((token) => token.trim()).filter(Boolean)
  const next = new Set<SourceId>()
  for (const token of tokens) {
    if (VALID_SOURCES.has(token as SourceId)) {
      next.add(token as SourceId)
    }
  }
  return next
}

function parseConfidence(raw: string | null): ConfidenceTone | null {
  if (!raw) return null
  return VALID_CONFIDENCE.has(raw as ConfidenceTone) ? (raw as ConfidenceTone) : null
}

export function useUrlState(): UrlStateValue & UrlStateActions {
  const [params, setParams] = useSearchParams()

  const value = useMemo<UrlStateValue>(() => {
    return {
      query: params.get('q') ?? '',
      filters: {
        sources: parseSources(params.get('source')),
        location: params.get('location'),
        confidence: parseConfidence(params.get('confidence')),
      },
      selectedRecordId: params.get('id'),
      selectedPersonId: params.get('person'),
    }
  }, [params])

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = false) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          mutate(next)
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  const setQuery = useCallback(
    (query: string) => {
      update((next) => {
        if (query) next.set('q', query)
        else next.delete('q')
      }, true)
    },
    [update],
  )

  const setFilters = useCallback(
    (filters: FilterState) => {
      update((next) => {
        if (filters.sources.size > 0) {
          next.set('source', [...filters.sources].sort().join(','))
        } else {
          next.delete('source')
        }
        if (filters.location) next.set('location', filters.location)
        else next.delete('location')
        if (filters.confidence) next.set('confidence', filters.confidence)
        else next.delete('confidence')
      })
    },
    [update],
  )

  const setSelectedRecord = useCallback(
    (recordId: string | null) => {
      update((next) => {
        if (recordId) next.set('id', recordId)
        else next.delete('id')
      })
    },
    [update],
  )

  const setSelectedPerson = useCallback(
    (personId: string | null) => {
      update((next) => {
        if (personId) next.set('person', personId)
        else next.delete('person')
      })
    },
    [update],
  )

  const resetAll = useCallback(() => {
    setParams(new URLSearchParams())
  }, [setParams])

  return {
    ...value,
    setQuery,
    setFilters,
    setSelectedRecord,
    setSelectedPerson,
    resetAll,
  }
}
