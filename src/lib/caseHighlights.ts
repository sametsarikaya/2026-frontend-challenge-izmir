import type {
  CaseHighlights,
  CaseRecord,
  ConfidenceTone,
  Person,
  ResolvedActor,
  SourceId,
} from '@/types/domain'
import { TURKISH_COLLATOR, normalizeText, uniqueValues } from './textNormalize'

const PODO_KEY = 'podo'

const SOURCE_SUSPICION_WEIGHTS: Record<SourceId, number> = {
  checkins: 2,
  messages: 2,
  notes: 2,
  sightings: 4,
  tips: 1,
}

const TIP_CONFIDENCE_WEIGHTS: Record<string, number> = {
  high: 6,
  medium: 4,
  low: 2,
}

const LAST_SEEN_SOURCE_PRIORITY: Partial<Record<SourceId, number>> = {
  sightings: 0,
  notes: 1,
}

const LATE_STAGE_WINDOW_MS = 25 * 60 * 1000
const CORROBORATION_WINDOW_MS = 18 * 60 * 1000
const CONFLICT_WINDOW_MS = 10 * 60 * 1000

const SECRECY_PATTERNS: ReadonlyArray<RegExp> = [
  /kimse bilmesin/,
  /son durak/,
  /son nokta/,
  /asil surpriz/,
  /gizemli/,
]

const LURE_PATTERNS: ReadonlyArray<RegExp> = [
  /kalabaliktan biraz uzaklasalim/,
  /bir yere gececegini/,
  /bir yere gecelim/,
  /son nokta/,
  /son durak/,
  /surpriz gosterecegim/,
]

const DOWNPLAY_PATTERNS: ReadonlyArray<RegExp> = [
  /yanlis anlasildi/,
  /sadece/,
  /abartildi/,
  /sorun yok/,
  /degilim/,
]

const TOGETHER_PATTERNS: ReadonlyArray<RegExp> = [
  /birlikte/,
  /beraber/,
  /yaninda/,
  /ile/,
  /yuruduk/,
  /gordum/,
  /goruldu/,
  /kaleye cikan/,
]

interface SuspicionSignal {
  points: number
  reason: string
}

interface SuspicionMetrics {
  contradictionCount: number
  lateStageCount: number
  lureMessageCount: number
  secrecyCount: number
  tipCount: number
  withPodoCount: number
}

interface SuspicionAssessment {
  classification: string
  statusTone: ConfidenceTone
  suspicionScore: number
  suspicionReasons: string[]
  suspicionMetrics: SuspicionMetrics
  withPodoCount: number
}

function actorIdsByRole(record: CaseRecord, roles: ReadonlyArray<ResolvedActor['role']>): string[] {
  return record.actors
    .filter((actor) => roles.includes(actor.role))
    .map((actor) => actor.personId)
    .filter((id): id is string => Boolean(id))
}

function actorIdByRole(record: CaseRecord, role: ResolvedActor['role']): string {
  return record.actors.find((actor) => actor.role === role)?.personId ?? ''
}

function hasKnownTime(record: CaseRecord): boolean {
  return Number.isFinite(record.sortTime) && record.sortTime > 0
}

function contentText(record: CaseRecord): string {
  const parts = [record.title, record.content, record.rawValues.note, record.rawValues.text].filter(Boolean)
  return normalizeText(parts.join(' '))
}

function sortByRecentEvidence(left: CaseRecord, right: CaseRecord): number {
  if (right.sortTime !== left.sortTime) return right.sortTime - left.sortTime
  return (LAST_SEEN_SOURCE_PRIORITY[left.sourceId] ?? 0) - (LAST_SEEN_SOURCE_PRIORITY[right.sourceId] ?? 0)
}

function isSecrecyRecord(record: CaseRecord): boolean {
  const text = contentText(record)
  return SECRECY_PATTERNS.some((pattern) => pattern.test(text))
}

function isLureMessage(record: CaseRecord): boolean {
  if (record.sourceId !== 'messages') return false
  const text = contentText(record)
  return LURE_PATTERNS.some((pattern) => pattern.test(text))
}

function isDownplayRecord(record: CaseRecord): boolean {
  const text = contentText(record)
  return DOWNPLAY_PATTERNS.some((pattern) => pattern.test(text))
}

function activeActorIds(record: CaseRecord): string[] {
  switch (record.sourceId) {
    case 'checkins':
      return actorIdsByRole(record, ['subject'])
    case 'messages':
      return actorIdsByRole(record, ['sender', 'recipient'])
    case 'sightings':
      return actorIdsByRole(record, ['subject', 'companion'])
    case 'notes':
      return actorIdsByRole(record, ['author'])
    case 'tips':
      return actorIdsByRole(record, ['suspect'])
  }
}

function relevantRecordsFor(records: ReadonlyArray<CaseRecord>, personId: string): CaseRecord[] {
  return records.filter((record) => record.personIds.includes(personId))
}

function directlyInvolves(record: CaseRecord, personId: string): boolean {
  return activeActorIds(record).includes(personId)
}

function locationKey(value: string): string {
  return normalizeText(value)
}

function sourceWeight(record: CaseRecord): number {
  return SOURCE_SUSPICION_WEIGHTS[record.sourceId] ?? 1
}

function findLatestConfirmedPodoTime(records: ReadonlyArray<CaseRecord>): number {
  return records.reduce((latest, record) => {
    if (!record.personIds.includes(PODO_KEY)) return latest
    if (!hasKnownTime(record)) return latest
    if (record.sourceId !== 'sightings' && record.sourceId !== 'checkins') return latest
    return Math.max(latest, record.sortTime)
  }, 0)
}

function classifySuspicion(score: number): { classification: string; statusTone: ConfidenceTone } {
  if (score >= 14) return { classification: 'High interest', statusTone: 'high' }
  if (score >= 8) return { classification: 'Watch closely', statusTone: 'medium' }
  return { classification: 'Context', statusTone: 'low' }
}

function findContradictionCount(relatedRecords: ReadonlyArray<CaseRecord>): number {
  const downplayRecords = relatedRecords.filter(isDownplayRecord)
  const concerning = relatedRecords.filter((record) => record.sourceId === 'tips' || isSecrecyRecord(record))
  return downplayRecords.length > 0 && concerning.length > 0
    ? Math.min(downplayRecords.length, concerning.length)
    : 0
}

function buildSuspicionForPerson(
  person: Person,
  records: ReadonlyArray<CaseRecord>,
  latestConfirmedPodoTime: number,
): SuspicionAssessment {
  const related = relevantRecordsFor(records, person.id)
  const withPodo = related.filter((record) => record.personIds.includes(PODO_KEY))
  const tipRecords = related.filter(
    (record) => record.sourceId === 'tips' && actorIdsByRole(record, ['suspect']).includes(person.id),
  )
  const secrecy = related.filter(isSecrecyRecord)
  const lures = related.filter((record) => directlyInvolves(record, person.id) && isLureMessage(record))
  const lateStage = withPodo.filter(
    (record) =>
      latestConfirmedPodoTime > 0 &&
      hasKnownTime(record) &&
      latestConfirmedPodoTime - record.sortTime <= LATE_STAGE_WINDOW_MS,
  )
  const contradictionCount = findContradictionCount(related)
  const podoLocations = uniqueValues(withPodo.map((record) => record.location)).length
  const proximityScore = Math.min(
    withPodo.reduce((total, record) => total + sourceWeight(record), 0),
    12,
  )
  const tipScore = tipRecords.reduce((total, record) => {
    const confidence = normalizeText(record.rawValues.confidence ?? '')
    return total + (TIP_CONFIDENCE_WEIGHTS[confidence] ?? TIP_CONFIDENCE_WEIGHTS.low)
  }, 0)

  const signals: SuspicionSignal[] = []
  let score = 0

  if (tipScore > 0) {
    score += tipScore
    signals.push({
      points: tipScore,
      reason: `Flagged in ${tipRecords.length} anonymous tip${tipRecords.length === 1 ? '' : 's'} with weighted confidence.`,
    })
  }
  if (proximityScore > 0) {
    score += proximityScore
    signals.push({
      points: proximityScore,
      reason: `Appears with Podo in ${withPodo.length} linked record${withPodo.length === 1 ? '' : 's'}.`,
    })
  }
  if (lateStage.length > 0) {
    const points = lateStage.some((record) => record.sourceId === 'sightings') ? 5 : 3
    score += points
    signals.push({ points, reason: 'Shows up in the final, most recent stage before Podo disappears.' })
  }
  if (secrecy.length > 0) {
    const points = Math.min(secrecy.length * 2, 6)
    score += points
    signals.push({ points, reason: 'Linked records contain secrecy or final-stop language.' })
  }
  if (lures.length > 0) {
    const points = Math.min(lures.length * 2, 4)
    score += points
    signals.push({
      points,
      reason: 'Message trail suggests attempts to move Podo away from the crowd.',
    })
  }
  if (contradictionCount > 0) {
    const points = Math.min(contradictionCount * 2, 4)
    score += points
    signals.push({ points, reason: 'Their records contain downplaying or inconsistent context.' })
  }
  if (podoLocations >= 2 && withPodo.length >= 2) {
    score += 2
    signals.push({
      points: 2,
      reason: `Trail follows this person and Podo across ${podoLocations} locations.`,
    })
  }

  if (signals.length === 0) {
    signals.push({ points: 0, reason: 'No strong suspicious pattern stands out yet.' })
  }

  const ranked = [...signals].sort((left, right) => right.points - left.points)
  const { classification, statusTone } = classifySuspicion(score)

  return {
    classification,
    statusTone,
    suspicionScore: score,
    suspicionReasons: ranked.slice(0, 3).map((signal) => signal.reason),
    suspicionMetrics: {
      contradictionCount,
      lateStageCount: lateStage.length,
      lureMessageCount: lures.length,
      secrecyCount: secrecy.length,
      tipCount: tipRecords.length,
      withPodoCount: withPodo.length,
    },
    withPodoCount: withPodo.length,
  }
}

export function scorePeople(people: ReadonlyArray<Person>, records: ReadonlyArray<CaseRecord>): Person[] {
  const latestConfirmed = findLatestConfirmedPodoTime(records)
  return people
    .map((person): Person => {
      if (person.id === PODO_KEY) {
        return {
          ...person,
          suspicionScore: 0,
          suspicionReasons: ['Podo is the missing subject, not a suspect.'],
        }
      }
      const assessment = buildSuspicionForPerson(person, records, latestConfirmed)
      return {
        ...person,
        suspicionScore: assessment.suspicionScore,
        suspicionReasons: assessment.suspicionReasons,
      }
    })
    .sort((left, right) => {
      if (right.suspicionScore !== left.suspicionScore) {
        return right.suspicionScore - left.suspicionScore
      }
      if (right.recordIds.length !== left.recordIds.length) {
        return right.recordIds.length - left.recordIds.length
      }
      return TURKISH_COLLATOR.compare(left.displayName, right.displayName)
    })
}

function personNameTokens(person: Person): string[] {
  return uniqueValues(
    [person.displayName, ...person.aliases]
      .flatMap((value) => normalizeText(value).split(' '))
      .filter((token) => token.length > 1),
  )
}

function recordMentionsPerson(record: CaseRecord, person: Person): boolean {
  const text = contentText(record)
  const tokens = personNameTokens(person)
  return tokens.some((token) => text.includes(token))
}

function noteCompanionIds(record: CaseRecord, peopleById: Map<string, Person>): string[] {
  const text = contentText(record)
  const authorId = actorIdByRole(record, 'author')
  const others = record.personIds.filter((id) => id !== PODO_KEY)
  const companions = new Set<string>()

  if (authorId && authorId !== PODO_KEY && TOGETHER_PATTERNS.some((pattern) => pattern.test(text))) {
    companions.add(authorId)
  }
  others.forEach((id) => {
    const person = peopleById.get(id)
    if (!person || id === authorId || !recordMentionsPerson(record, person)) return
    if (TOGETHER_PATTERNS.some((pattern) => pattern.test(text))) {
      companions.add(id)
    }
  })
  return [...companions]
}

function extractCompanionIds(record: CaseRecord, peopleById: Map<string, Person>): string[] {
  if (!record.personIds.includes(PODO_KEY)) return []
  if (record.sourceId === 'sightings') return record.personIds.filter((id) => id !== PODO_KEY)
  if (record.sourceId === 'notes') return noteCompanionIds(record, peopleById)
  return []
}

interface LastSeenCandidate {
  recordId: string
  personId: string
  personName: string
  location: string
  sortTime: number
  sourceId: SourceId
  sourceLabel: string
  timestampLabel: string
  confirmed: boolean
  statusTone: ConfidenceTone
}

function buildLastSeenCandidate(
  record: CaseRecord,
  personId: string,
  peopleById: Map<string, Person>,
): LastSeenCandidate | null {
  const person = peopleById.get(personId)
  if (!person || !hasKnownTime(record)) return null
  return {
    recordId: record.id,
    personId,
    personName: person.displayName,
    location: record.location,
    sortTime: record.sortTime,
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    timestampLabel: record.timestampLabel,
    confirmed: record.sourceId === 'sightings',
    statusTone: record.sourceId === 'sightings' ? 'high' : 'medium',
  }
}

function findCorroboratingRecords(
  candidate: LastSeenCandidate,
  records: ReadonlyArray<CaseRecord>,
  peopleById: Map<string, Person>,
): CaseRecord[] {
  const person = peopleById.get(candidate.personId)
  if (!person) return []
  return records
    .filter((record) => {
      if (record.id === candidate.recordId || !hasKnownTime(record)) return false
      if (!record.personIds.includes(PODO_KEY)) return false
      if (Math.abs(record.sortTime - candidate.sortTime) > CORROBORATION_WINDOW_MS) return false
      const sameLocation = locationKey(record.location) === locationKey(candidate.location)
      const sameCompanion = record.personIds.includes(candidate.personId)
      return sameLocation && (sameCompanion || recordMentionsPerson(record, person))
    })
    .sort(sortByRecentEvidence)
}

function findConflictingCandidates(
  candidate: LastSeenCandidate,
  candidates: ReadonlyArray<LastSeenCandidate>,
): LastSeenCandidate[] {
  return candidates.filter(
    (entry) =>
      entry.recordId !== candidate.recordId &&
      entry.personId !== candidate.personId &&
      Math.abs(entry.sortTime - candidate.sortTime) <= CONFLICT_WINDOW_MS,
  )
}

function findLastKnownRecord(records: ReadonlyArray<CaseRecord>): CaseRecord | null {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].personIds.includes(PODO_KEY)) return records[i]
  }
  return records[records.length - 1] ?? null
}

export function buildHighlights(
  records: ReadonlyArray<CaseRecord>,
  people: ReadonlyArray<Person>,
): CaseHighlights {
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const candidates: LastSeenCandidate[] = []
  records.forEach((record) => {
    extractCompanionIds(record, peopleById).forEach((personId) => {
      const candidate = buildLastSeenCandidate(record, personId, peopleById)
      if (candidate) candidates.push(candidate)
    })
  })
  candidates.sort((left, right) => {
    if (right.sortTime !== left.sortTime) return right.sortTime - left.sortTime
    return (LAST_SEEN_SOURCE_PRIORITY[left.sourceId] ?? 0) - (LAST_SEEN_SOURCE_PRIORITY[right.sourceId] ?? 0)
  })

  const confirmed = candidates.filter((candidate) => candidate.confirmed)
  const chosen = confirmed[0] ?? candidates[0] ?? null

  let lastSeenWith: Person | null = null
  if (chosen) {
    const corroborating = findCorroboratingRecords(chosen, records, peopleById)
    const conflicts = findConflictingCandidates(chosen, confirmed)
    const explanation: string[] = [
      chosen.confirmed
        ? `Latest confirmed sighting puts Podo with ${chosen.personName} at ${chosen.location} on ${chosen.timestampLabel}.`
        : `Best available evidence places Podo with ${chosen.personName} at ${chosen.location} on ${chosen.timestampLabel}.`,
    ]
    if (corroborating.length > 0) {
      explanation.push(
        `${corroborating.length} nearby corroborating record${corroborating.length === 1 ? '' : 's'} support the same pairing.`,
      )
    }
    if (conflicts.length > 0) {
      explanation.push(
        'Another late sighting names someone else nearby, so treat this as the strongest lead rather than absolute certainty.',
      )
    }
    const person = peopleById.get(chosen.personId)
    if (person) {
      lastSeenWith = {
        ...person,
        suspicionReasons: explanation,
      }
    }
  }

  const mostSuspicious = people.find((person) => person.id !== PODO_KEY) ?? null

  return {
    lastSeenWith,
    mostSuspicious,
    lastKnownRecord: findLastKnownRecord(records),
  }
}
