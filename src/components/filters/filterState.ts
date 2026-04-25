import type { ConfidenceTone, SourceId } from '@/types/domain'

export interface FilterState {
  sources: ReadonlySet<SourceId>
  location: string | null
  confidence: ConfidenceTone | null
}

export const EMPTY_FILTERS: FilterState = {
  sources: new Set(),
  location: null,
  confidence: null,
}

export function isFilterEmpty(state: FilterState): boolean {
  return state.sources.size === 0 && state.location === null && state.confidence === null
}
