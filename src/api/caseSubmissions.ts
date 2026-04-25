import type {
  JotformSubmission,
  SourceConfig,
  SourceId,
  SourceLoadError,
  SourceLoadOutcome,
  SourceLoadResult,
} from '@/types/domain'

const SUBMISSION_LIMIT = '100'

function parseKeys(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

const ENV_KEYS = parseKeys(import.meta.env.VITE_JOTFORM_KEYS)

const FORM_ID_BY_SOURCE: Record<SourceId, string> = {
  checkins: import.meta.env.VITE_FORM_CHECKINS,
  messages: import.meta.env.VITE_FORM_MESSAGES,
  sightings: import.meta.env.VITE_FORM_SIGHTINGS,
  notes: import.meta.env.VITE_FORM_NOTES,
  tips: import.meta.env.VITE_FORM_TIPS,
}

export const SOURCES: ReadonlyArray<SourceConfig> = [
  { id: 'checkins', label: 'Check-Ins', formId: FORM_ID_BY_SOURCE.checkins },
  { id: 'messages', label: 'Messages', formId: FORM_ID_BY_SOURCE.messages },
  { id: 'sightings', label: 'Sightings', formId: FORM_ID_BY_SOURCE.sightings },
  { id: 'notes', label: 'Personal Notes', formId: FORM_ID_BY_SOURCE.notes },
  { id: 'tips', label: 'Anonymous Tips', formId: FORM_ID_BY_SOURCE.tips },
]

interface JotformResponse {
  responseCode?: number
  message?: string
  content?: unknown
}

function buildEndpoint(formId: string, apiKey: string): string {
  const params = new URLSearchParams({ apiKey, limit: SUBMISSION_LIMIT })
  return `https://api.jotform.com/form/${formId}/submissions?${params.toString()}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown source error'
}

async function fetchWithKey(
  source: SourceConfig,
  apiKey: string,
  signal: AbortSignal,
): Promise<JotformSubmission[]> {
  const response = await fetch(buildEndpoint(source.formId, apiKey), { signal })
  let payload: JotformResponse | null = null

  try {
    payload = (await response.json()) as JotformResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${source.label}`)
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid Jotform payload on ${source.label}`)
  }

  if (payload.responseCode === 200 && Array.isArray(payload.content)) {
    return payload.content as JotformSubmission[]
  }

  throw new Error(payload.message ?? `Unknown Jotform error on ${source.label}`)
}

async function fetchSourceWithFallback(
  source: SourceConfig,
  signal: AbortSignal,
): Promise<SourceLoadResult> {
  if (ENV_KEYS.length === 0) {
    throw new Error('No Jotform API keys configured. Check VITE_JOTFORM_KEYS in .env.')
  }

  const failures: string[] = []

  for (const apiKey of ENV_KEYS) {
    try {
      const submissions = await fetchWithKey(source, apiKey, signal)
      return { source, submissions }
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      failures.push(getErrorMessage(error))
    }
  }

  throw new Error(failures.filter(Boolean).join(' | ') || `All keys failed for ${source.label}`)
}

export async function fetchAllSources(signal: AbortSignal): Promise<SourceLoadOutcome> {
  const settled = await Promise.allSettled(
    SOURCES.map((source) => fetchSourceWithFallback(source, signal)),
  )

  const sources: SourceLoadResult[] = []
  const errors: SourceLoadError[] = []

  settled.forEach((entry, index) => {
    const source = SOURCES[index]
    if (entry.status === 'fulfilled') {
      sources.push(entry.value)
    } else {
      errors.push({
        sourceId: source.id,
        sourceLabel: source.label,
        message: getErrorMessage(entry.reason),
      })
    }
  })

  return { sources, errors }
}
