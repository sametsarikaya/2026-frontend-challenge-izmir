import type {
  CaseRecord,
  InvestigationModel,
  Person,
  SourceId,
  SourceLoadError,
  SourceLoadResult,
} from '@/types/domain'
import { buildHighlights, scorePeople } from './caseHighlights'
import { resolveIdentities } from './identityResolver'
import { buildResolvedTitle, buildSearchText, normalizeSubmission } from './normalizers'
import { TURKISH_COLLATOR, normalizeText, uniqueValues } from './textNormalize'
import type { NormalizedSubmission } from './normalizers'

const SOURCE_PRIORITY: Partial<Record<SourceId, number>> = {
  checkins: 0,
  messages: 1,
  notes: 2,
  sightings: 3,
  tips: 4,
}

const RELATED_TIME_WINDOW_MS = 45 * 60 * 1000

/**
 * Canonicalize locations: group by normalized (diacritics-stripped) form,
 * then pick the most frequent spelling as the canonical display name.
 * E.g. "Asansör" (3 hits) + "Asansor" (1 hit) → all become "Asansör".
 */
function buildLocationCanonMap(
  entries: ReadonlyArray<NormalizedSubmission>,
): Map<string, string> {
  const buckets = new Map<string, Map<string, number>>()
  for (const entry of entries) {
    const raw = entry.location
    if (!raw || raw === 'Unknown location') continue
    const key = normalizeText(raw)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = new Map<string, number>()
      buckets.set(key, bucket)
    }
    bucket.set(raw, (bucket.get(raw) ?? 0) + 1)
  }
  const canon = new Map<string, string>()
  for (const [key, bucket] of buckets) {
    let best = ''
    let bestCount = 0
    for (const [variant, count] of bucket) {
      if (count > bestCount || (count === bestCount && variant.length > best.length)) {
        best = variant
        bestCount = count
      }
    }
    canon.set(key, best)
  }
  return canon
}

function canonicalizeLocation(raw: string, canonMap: Map<string, string>): string {
  if (!raw || raw === 'Unknown location') return raw
  return canonMap.get(normalizeText(raw)) ?? raw
}

function buildLocationIndex(records: ReadonlyArray<CaseRecord>): Map<string, string[]> {
  const index = new Map<string, string[]>()
  records.forEach((record) => {
    const key = normalizeText(record.location)
    const list = index.get(key) ?? []
    list.push(record.id)
    index.set(key, list)
  })
  return index
}

function buildPersonRecordIndex(records: ReadonlyArray<CaseRecord>): Map<string, string[]> {
  const index = new Map<string, string[]>()
  records.forEach((record) => {
    record.personIds.forEach((personId) => {
      const list = index.get(personId) ?? []
      list.push(record.id)
      index.set(personId, list)
    })
  })
  return index
}

function findRelatedRecordIds(
  record: CaseRecord,
  recordsById: Map<string, CaseRecord>,
  personIndex: Map<string, string[]>,
  locationIndex: Map<string, string[]>,
): string[] {
  const relatedIds = new Set<string>()

  record.personIds.forEach((personId) => {
    const matches = personIndex.get(personId) ?? []
    matches.forEach((recordId) => {
      if (recordId !== record.id) relatedIds.add(recordId)
    })
  })

  const locationMatches = locationIndex.get(normalizeText(record.location)) ?? []
  locationMatches.forEach((recordId) => {
    if (recordId === record.id) return
    const otherRecord = recordsById.get(recordId)
    if (!otherRecord) return
    const closeInTime =
      !record.sortTime || !otherRecord.sortTime
        ? true
        : Math.abs(record.sortTime - otherRecord.sortTime) <= RELATED_TIME_WINDOW_MS
    if (closeInTime) relatedIds.add(recordId)
  })

  return [...relatedIds].sort((leftId, rightId) => {
    const leftRecord = recordsById.get(leftId)
    const rightRecord = recordsById.get(rightId)
    return (leftRecord?.sortTime ?? 0) - (rightRecord?.sortTime ?? 0)
  })
}

export function buildInvestigationModel(
  loadedSources: ReadonlyArray<SourceLoadResult>,
  sourceErrors: ReadonlyArray<SourceLoadError>,
): InvestigationModel {
  const normalized = loadedSources
    .flatMap(({ source, submissions }) =>
      submissions.map((submission) => normalizeSubmission(source, submission)),
    )
    .sort((left, right) => left.sortTime - right.sortTime)

  // Canonicalize locations so "Asansör" and "Asansor" merge
  const locationCanon = buildLocationCanonMap(normalized)
  for (const entry of normalized) {
    entry.location = canonicalizeLocation(entry.location, locationCanon)
  }

  const { people: resolvedPeople, peopleById, resolvedRecords } = resolveIdentities(
    normalized,
    SOURCE_PRIORITY,
  )

  const peopleIndex = new Map(resolvedPeople.map((person) => [person.id, person]))

  const baseRecords: CaseRecord[] = normalized.map((entry, index) => {
    const resolved = resolvedRecords[index]
    const actorsForRecord = resolved.actors.map((actor) => ({
      ...actor,
      label: peopleIndex.get(actor.personId)?.displayName ?? actor.label,
    }))
    const personIds = uniqueValues(actorsForRecord.map((actor) => actor.personId))
    const baseRecord: CaseRecord = {
      id: entry.id,
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      rawTitle: entry.rawTitle,
      title: entry.rawTitle,
      content: entry.content,
      location: entry.location,
      geo: entry.geo,
      timestamp: entry.timestamp,
      sortTime: entry.sortTime,
      timestampLabel: entry.timestampLabel,
      timeLabel: entry.timeLabel,
      actors: actorsForRecord,
      personIds,
      flags: entry.flags,
      rawValues: entry.rawValues,
      searchText: '',
      relatedRecordIds: [],
    }
    return {
      ...baseRecord,
      title: buildResolvedTitle(entry.sourceId, actorsForRecord, entry.rawTitle),
    }
  })

  const scoredPeople = scorePeople(resolvedPeople, baseRecords)
  const scoredById = new Map(scoredPeople.map((person) => [person.id, person]))

  const recordsWithLatestNames: CaseRecord[] = baseRecords.map((record) => ({
    ...record,
    actors: record.actors.map((actor) => ({
      ...actor,
      label: scoredById.get(actor.personId)?.displayName ?? actor.label,
    })),
  }))

  const recordsById = new Map(recordsWithLatestNames.map((record) => [record.id, record]))
  const personIndex = buildPersonRecordIndex(recordsWithLatestNames)
  const locationIndex = buildLocationIndex(recordsWithLatestNames)

  const finalRecords: CaseRecord[] = recordsWithLatestNames.map((record) => {
    const enriched: CaseRecord = {
      ...record,
      relatedRecordIds: findRelatedRecordIds(record, recordsById, personIndex, locationIndex),
      searchText: '',
    }
    enriched.searchText = buildSearchText(enriched)
    return enriched
  })

  const finalRecordsById = new Map(finalRecords.map((record) => [record.id, record]))
  const highlights = buildHighlights(finalRecords, scoredPeople)
  const peopleWithCounts: Person[] = scoredPeople.map((person) => ({
    ...person,
    recordCount: person.recordIds.length,
  }))

  return {
    records: finalRecords,
    recordsById: finalRecordsById,
    people: peopleWithCounts,
    peopleById,
    locations: uniqueValues(finalRecords.map((record) => record.location)).sort(
      (left, right) => TURKISH_COLLATOR.compare(left, right),
    ),
    highlights,
    sourceSummary: {
      loaded: loadedSources.length,
      total: loadedSources.length + sourceErrors.length,
    },
  }
}
