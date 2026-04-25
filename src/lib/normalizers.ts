import type {
  CaseRecord,
  Geo,
  JotformSubmission,
  RawActor,
  RecordFlag,
  ResolvedActor,
  SourceConfig,
  SourceId,
} from '@/types/domain'
import { formatClock, formatDateTime, parseTimestamp } from './dateFormat'
import { normalizeText, uniqueValues } from './textNormalize'

function parseGeo(rawValue: string | undefined): Geo | null {
  if (!rawValue) return null
  const parts = rawValue
    .split(',')
    .map((value) => Number(value.trim()))
  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) {
    return null
  }
  return { lat: parts[0], lng: parts[1] }
}

function readAnswers(submission: JotformSubmission): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of Object.values(submission.answers)) {
    if (!entry || typeof entry.name !== 'string') continue
    const answerValue = entry.answer
    if (answerValue === null || answerValue === undefined) {
      result[entry.name] = ''
    } else if (typeof answerValue === 'string' || typeof answerValue === 'number') {
      result[entry.name] = String(answerValue)
    } else {
      result[entry.name] = ''
    }
  }
  return result
}

function splitNameList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[,;/]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function buildActors(sourceId: SourceId, values: Record<string, string>): RawActor[] {
  switch (sourceId) {
    case 'checkins':
      return [{ label: values.personName ?? '', role: 'subject' }]
    case 'messages':
      return [
        { label: values.senderName ?? '', role: 'sender' },
        { label: values.recipientName ?? '', role: 'recipient' },
      ]
    case 'sightings':
      return [
        { label: values.personName ?? '', role: 'subject' },
        { label: values.seenWith ?? '', role: 'companion' },
      ]
    case 'notes': {
      const author: RawActor = { label: values.authorName ?? '', role: 'author' }
      const mentioned = splitNameList(values.mentionedPeople).map(
        (label): RawActor => ({ label, role: 'mentioned' }),
      )
      return [author, ...mentioned]
    }
    case 'tips':
      return [{ label: values.suspectName ?? '', role: 'suspect' }]
  }
}

function buildRawTitle(sourceId: SourceId, values: Record<string, string>): string {
  switch (sourceId) {
    case 'checkins':
      return `${values.personName || 'Unknown person'} checked in`
    case 'messages':
      return `${values.senderName || 'Unknown sender'} → ${values.recipientName || 'Unknown recipient'}`
    case 'sightings':
      return `${values.personName || 'Unknown subject'} seen with ${values.seenWith || 'unknown companion'}`
    case 'notes':
      return `Note by ${values.authorName || 'Unknown author'}`
    case 'tips':
      return `Anonymous tip about ${values.suspectName || 'unknown suspect'}`
  }
}

function buildContent(sourceId: SourceId, values: Record<string, string>): string {
  switch (sourceId) {
    case 'messages':
      return values.text ?? ''
    case 'tips':
      return values.tip ?? ''
    default:
      return values.note ?? ''
  }
}

function urgencyTone(urgency: string): RecordFlag['tone'] {
  const lower = urgency.toLowerCase()
  if (lower.includes('high') || lower.includes('urgent')) return 'high'
  if (lower.includes('medium') || lower.includes('mid')) return 'medium'
  return 'low'
}

function buildFlags(sourceId: SourceId, values: Record<string, string>): RecordFlag[] {
  const flags: RecordFlag[] = []
  if (sourceId === 'messages' && values.urgency) {
    flags.push({ label: `Urgency: ${values.urgency}`, tone: urgencyTone(values.urgency) })
  }
  if (sourceId === 'tips' && values.confidence) {
    flags.push({ label: `Confidence: ${values.confidence}`, tone: urgencyTone(values.confidence) })
  }
  return flags
}

export interface NormalizedSubmission {
  id: string
  sourceId: SourceId
  sourceLabel: string
  rawTitle: string
  content: string
  location: string
  geo: Geo | null
  timestamp: Date | null
  sortTime: number
  timestampLabel: string
  timeLabel: string
  rawActors: RawActor[]
  flags: RecordFlag[]
  rawValues: Record<string, string>
}

export function normalizeSubmission(
  source: SourceConfig,
  submission: JotformSubmission,
): NormalizedSubmission {
  const values = readAnswers(submission)
  const timestamp = parseTimestamp(values.timestamp)
  const rawActors = buildActors(source.id, values).filter((actor) => actor.label.trim().length > 0)

  return {
    id: `${source.id}:${submission.id}`,
    sourceId: source.id,
    sourceLabel: source.label,
    rawTitle: buildRawTitle(source.id, values),
    content: buildContent(source.id, values),
    location: values.location?.trim() || 'Unknown location',
    geo: parseGeo(values.coordinates),
    timestamp,
    sortTime: timestamp ? timestamp.getTime() : 0,
    timestampLabel: formatDateTime(timestamp),
    timeLabel: formatClock(timestamp),
    rawActors,
    flags: buildFlags(source.id, values),
    rawValues: values,
  }
}

export function buildResolvedTitle(
  sourceId: SourceId,
  actors: ResolvedActor[],
  rawTitle: string,
): string {
  const labelByRole = new Map(actors.map((actor) => [actor.role, actor.label]))

  switch (sourceId) {
    case 'checkins':
      return `${labelByRole.get('subject') || 'Unknown person'} checked in`
    case 'messages':
      return `${labelByRole.get('sender') || 'Unknown sender'} → ${labelByRole.get('recipient') || 'Unknown recipient'}`
    case 'sightings':
      return `${labelByRole.get('subject') || 'Unknown subject'} seen with ${labelByRole.get('companion') || 'unknown companion'}`
    case 'notes':
      return `Note by ${labelByRole.get('author') || 'Unknown author'}`
    case 'tips':
      return `Anonymous tip about ${labelByRole.get('suspect') || 'unknown suspect'}`
    default:
      return rawTitle
  }
}

export function buildSearchText(record: CaseRecord): string {
  const parts: string[] = [
    record.sourceLabel,
    record.title,
    record.rawTitle,
    record.location,
    record.content,
  ]
  for (const actor of record.actors) {
    parts.push(actor.label)
    parts.push(actor.rawLabel)
    parts.push(actor.role)
  }
  return normalizeText(uniqueValues(parts).join(' '))
}
