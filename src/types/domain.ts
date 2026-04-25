export type SourceId = 'checkins' | 'messages' | 'sightings' | 'notes' | 'tips'

export interface SourceConfig {
  id: SourceId
  label: string
  formId: string
}

export interface Geo {
  lat: number
  lng: number
}

export type ActorRole =
  | 'subject'
  | 'sender'
  | 'recipient'
  | 'companion'
  | 'author'
  | 'mentioned'
  | 'suspect'

export type ConfidenceTone = 'high' | 'medium' | 'low'

export interface RawActor {
  label: string
  role: ActorRole
}

export interface ResolvedActor {
  label: string
  rawLabel: string
  role: ActorRole
  personId: string
  aliasKey: string
  resolutionConfidence: ConfidenceTone
  resolutionReasons: string[]
}

export interface RecordFlag {
  label: string
  tone: 'low' | 'medium' | 'high'
}

export interface RawSubmissionAnswers {
  [questionId: string]: { name?: string; text?: string; answer?: unknown } | undefined
}

export interface JotformSubmission {
  id: string
  answers: RawSubmissionAnswers
}

export interface CaseRecord {
  id: string
  sourceId: SourceId
  sourceLabel: string
  rawTitle: string
  title: string
  content: string
  location: string
  geo: Geo | null
  timestamp: Date | null
  sortTime: number
  timestampLabel: string
  timeLabel: string
  actors: ResolvedActor[]
  personIds: string[]
  flags: RecordFlag[]
  rawValues: Record<string, string>
  searchText: string
  relatedRecordIds: string[]
}

export interface AliasMatchDetail {
  alias: string
  confidenceLabel: string
  mentionCount: number
  reasons: string[]
  score: number
  statusTone: ConfidenceTone
}

export interface UncertainMatch {
  alias: string
  confidenceLabel: string
  reasons: string[]
  score: number
  statusTone: ConfidenceTone
}

export interface SourceCount {
  sourceId: SourceId
  count: number
}

export interface Person {
  id: string
  displayName: string
  aliases: string[]
  aliasDetails: AliasMatchDetail[]
  recordIds: string[]
  locations: string[]
  matchConfidence: ConfidenceTone
  matchConfidenceLabel: string
  matchReasons: string[]
  matchSummary: string
  sourceBreakdown: SourceCount[]
  uncertainMatches: UncertainMatch[]
  recordCount: number
  suspicionScore: number
  suspicionReasons: string[]
}

export interface SourceLoadResult {
  source: SourceConfig
  submissions: JotformSubmission[]
}

export interface SourceLoadError {
  sourceId: SourceId
  sourceLabel: string
  message: string
}

export interface SourceLoadOutcome {
  sources: SourceLoadResult[]
  errors: SourceLoadError[]
}

export interface CaseHighlights {
  lastSeenWith: Person | null
  mostSuspicious: Person | null
  lastKnownRecord: CaseRecord | null
}

export interface InvestigationModel {
  records: CaseRecord[]
  recordsById: Map<string, CaseRecord>
  people: Person[]
  peopleById: Map<string, Person>
  locations: string[]
  highlights: CaseHighlights
  sourceSummary: { loaded: number; total: number }
}
