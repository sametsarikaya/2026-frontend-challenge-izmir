import type { CaseRecord, Person } from '@/types/domain'
import { normalizeText, stringSimilarity } from './textNormalize'

const RECORD_LIMIT = 40
const PERSON_LIMIT = 20
const TOKEN_SIMILARITY_THRESHOLD = 0.7
const MAX_TOKEN_SIMILARITY_BONUS = 25
const SUBSTRING_BASE_SCORE = 100
const TOKEN_EXACT_BONUS = 30

export interface RecordHit {
  record: CaseRecord
  score: number
}

export interface PersonHit {
  person: Person
  score: number
}

export interface SearchResultsByGroup {
  records: RecordHit[]
  people: PersonHit[]
  query: string
}

function scoreAgainst(query: string, target: string): number {
  if (!query || !target) return 0
  if (target === query) return SUBSTRING_BASE_SCORE + 20
  if (target.includes(query)) {
    return SUBSTRING_BASE_SCORE - Math.min(target.length - query.length, 80) * 0.2
  }

  const queryTokens = query.split(' ').filter(Boolean)
  if (queryTokens.length === 0) return 0
  const targetTokens = new Set(target.split(' ').filter(Boolean))
  if (targetTokens.size === 0) return 0

  let total = 0
  for (const token of queryTokens) {
    if (targetTokens.has(token)) {
      total += TOKEN_EXACT_BONUS
      continue
    }
    let bestSimilarity = 0
    for (const candidate of targetTokens) {
      if (candidate.length < 2) continue
      const similarity = stringSimilarity(token, candidate)
      if (similarity > bestSimilarity) bestSimilarity = similarity
    }
    if (bestSimilarity >= TOKEN_SIMILARITY_THRESHOLD) {
      total += bestSimilarity * MAX_TOKEN_SIMILARITY_BONUS
    }
  }
  return total
}

export function searchRecords(
  query: string,
  records: ReadonlyArray<CaseRecord>,
): RecordHit[] {
  const normalized = normalizeText(query)
  if (!normalized) return []
  const hits: RecordHit[] = []
  for (const record of records) {
    const score = scoreAgainst(normalized, record.searchText)
    if (score > 0) hits.push({ record, score })
  }
  hits.sort((left, right) => right.score - left.score)
  return hits.slice(0, RECORD_LIMIT)
}

export function searchPeople(
  query: string,
  people: ReadonlyArray<Person>,
): PersonHit[] {
  const normalized = normalizeText(query)
  if (!normalized) return []
  const hits: PersonHit[] = []
  for (const person of people) {
    const target = normalizeText([person.displayName, ...person.aliases].join(' '))
    const score = scoreAgainst(normalized, target)
    if (score > 0) hits.push({ person, score })
  }
  hits.sort((left, right) => right.score - left.score)
  return hits.slice(0, PERSON_LIMIT)
}

export function searchAll(
  query: string,
  records: ReadonlyArray<CaseRecord>,
  people: ReadonlyArray<Person>,
): SearchResultsByGroup {
  return {
    query,
    records: searchRecords(query, records),
    people: searchPeople(query, people),
  }
}
