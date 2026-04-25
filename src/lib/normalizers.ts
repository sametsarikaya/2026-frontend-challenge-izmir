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

function answerToString(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
  return ''
}

function labelKey(text: string): string {
  return normalizeText(text)
    .replace(/\s+/g, '')
    .slice(0, 40)
}

function readAnswers(submission: JotformSubmission): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of Object.values(submission.answers)) {
    if (!entry) continue
    const value = answerToString(entry.answer)
    if (typeof entry.name === 'string' && entry.name) {
      result[entry.name] = value
    }
    if (typeof entry.text === 'string' && entry.text) {
      const lk = labelKey(entry.text)
      if (lk && !(lk in result)) result[lk] = value
    }
  }
  if (import.meta.env.DEV && !_loggedSources.has(submission.id.slice(0, 6))) {
    _loggedSources.add(submission.id.slice(0, 6))
    // eslint-disable-next-line no-console
    console.log('[normalizer] available keys:', Object.keys(result))
  }
  return result
}

const _loggedSources = new Set<string>()

function pick(values: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = values[key]
    if (v) return v
  }
  return ''
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
      return [{
        label: pick(values,
          'fullname', 'fullName',
          'personName', 'kisiAdi', 'kisiadi', 'adisoyadi', 'adsoyad', 'kisi', 'person',
          'isim', 'ad', 'name',
        ),
        role: 'subject',
      }]
    case 'messages':
      return [
        {
          label: pick(values,
            'senderName', 'gonderen', 'gönderen', 'sender', 'kimden', 'gonderenad',
            'gonderenisim', 'from',
          ),
          role: 'sender',
        },
        {
          label: pick(values,
            'recipientName', 'alici', 'alıcı', 'recipient', 'kime', 'aliciad',
            'aliciisim', 'to',
          ),
          role: 'recipient',
        },
      ]
    case 'sightings':
      return [
        {
          label: pick(values,
            'fullname', 'fullName',
            'personName', 'kisiAdi', 'kisiadi', 'gorulenkisi', 'görülenkişi',
            'subject', 'kisi', 'person', 'isim', 'ad', 'name',
          ),
          role: 'subject',
        },
        {
          label: pick(values,
            'seenWith', 'birlikte', 'companion', 'arkadasiyla', 'arkadaşıyla',
            'beraberindekikisi', 'beraberkisi', 'with',
          ),
          role: 'companion',
        },
      ]
    case 'notes': {
      const author: RawActor = {
        label: pick(values,
          'fullname', 'fullName',
          'authorName', 'author', 'yazar', 'yazan', 'yazarad',
          'noteAuthor', 'personName', 'kisi', 'isim', 'ad',
        ),
        role: 'author',
      }
      const mentionedRaw = pick(values,
        'mentionedPeople', 'bahsedilenler', 'kisiIsmi', 'kisiismi',
        'mentionepeople', 'mentioned',
      )
      const mentioned = splitNameList(mentionedRaw).map(
        (label): RawActor => ({ label, role: 'mentioned' }),
      )
      return [author, ...mentioned]
    }
    case 'tips':
      return [{
        label: pick(values,
          'suspectName', 'suphe', 'şüpheli', 'suspect', 'kisi', 'person',
          'supheli', 'isim', 'ad', 'name',
        ),
        role: 'suspect',
      }]
  }
}

function buildRawTitle(sourceId: SourceId, values: Record<string, string>): string {
  switch (sourceId) {
    case 'checkins': {
      const name = pick(values, 'fullname', 'fullName', 'personName', 'kisiAdi', 'kisiadi', 'kisi', 'person', 'isim', 'ad', 'name', 'adisoyadi', 'adsoyad')
      return `${name || 'Unknown person'} checked in`
    }
    case 'messages': {
      const sender = pick(values, 'senderName', 'gonderen', 'gönderen', 'sender', 'kimden', 'from')
      const recipient = pick(values, 'recipientName', 'alici', 'alıcı', 'recipient', 'kime', 'to')
      return `${sender || 'Unknown sender'} → ${recipient || 'Unknown recipient'}`
    }
    case 'sightings': {
      const subject = pick(values, 'fullname', 'fullName', 'personName', 'kisiAdi', 'kisiadi', 'gorulenkisi', 'subject', 'kisi', 'person', 'isim', 'ad', 'name')
      const companion = pick(values, 'seenWith', 'birlikte', 'companion', 'arkadasiyla', 'arkadaşıyla', 'with')
      return `${subject || 'Unknown subject'} seen with ${companion || 'unknown companion'}`
    }
    case 'notes': {
      const author = pick(values, 'fullname', 'fullName', 'authorName', 'author', 'yazar', 'yazan', 'personName', 'kisi', 'isim', 'ad')
      return `Note by ${author || 'Unknown author'}`
    }
    case 'tips': {
      const suspect = pick(values, 'suspectName', 'suphe', 'şüpheli', 'suspect', 'supheli', 'kisi', 'isim', 'ad', 'name')
      return `Anonymous tip about ${suspect || 'unknown suspect'}`
    }
  }
}

function buildContent(sourceId: SourceId, values: Record<string, string>): string {
  switch (sourceId) {
    case 'messages':
      return pick(values, 'text', 'mesaj', 'icerik', 'içerik', 'message', 'body')
    case 'tips':
      return pick(values, 'tip', 'not', 'bilgi', 'body', 'icerik', 'içerik', 'message', 'text')
    default:
      return pick(values, 'note', 'not', 'aciklama', 'açıklama', 'description', 'icerik', 'içerik', 'text')
  }
}

function urgencyTone(urgency: string): RecordFlag['tone'] {
  const lower = urgency.toLowerCase()
  if (lower.includes('high') || lower.includes('urgent') || lower.includes('yüksek') || lower.includes('acil')) return 'high'
  if (lower.includes('medium') || lower.includes('mid') || lower.includes('orta')) return 'medium'
  return 'low'
}

function buildFlags(sourceId: SourceId, values: Record<string, string>): RecordFlag[] {
  const flags: RecordFlag[] = []
  const urgency = pick(values, 'urgency', 'aciliyet', 'öncelik', 'oncelik')
  if (sourceId === 'messages' && urgency) {
    flags.push({ label: `Urgency: ${urgency}`, tone: urgencyTone(urgency) })
  }
  const confidence = pick(values, 'confidence', 'guven', 'güven', 'dogruluk', 'doğruluk')
  if (sourceId === 'tips' && confidence) {
    flags.push({ label: `Confidence: ${confidence}`, tone: urgencyTone(confidence) })
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
  const timestampRaw = pick(values, 'timestamp', 'tarih', 'zaman', 'datetime', 'date', 'time', 'tarihSaat', 'tarihsaat')
  const timestamp = parseTimestamp(timestampRaw)
  const rawActors = buildActors(source.id, values).filter((actor) => actor.label.trim().length > 0)

  const locationRaw = pick(values,
    'location', 'konum', 'yer', 'adres', 'address', 'lokasyon', 'place',
  )
  const coordinatesRaw = pick(values,
    'coordinates', 'koordinat', 'geo', 'latlong', 'latLong', 'latlng',
  )

  return {
    id: `${source.id}:${submission.id}`,
    sourceId: source.id,
    sourceLabel: source.label,
    rawTitle: buildRawTitle(source.id, values),
    content: buildContent(source.id, values),
    location: locationRaw.trim() || 'Unknown location',
    geo: parseGeo(coordinatesRaw),
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
