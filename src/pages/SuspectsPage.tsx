import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCaseData } from '@/hooks/useCaseData'
import { ErrorCard } from '@/components/feedback/ErrorCard'
import { SkeletonStack } from '@/components/feedback/SkeletonRow'
import { EmptyState } from '@/components/feedback/EmptyState'
import { normalizeText } from '@/lib/textNormalize'
import type { InvestigationModel, Person } from '@/types/domain'

const PODO_KEY = normalizeText('Podo')

function suspicionLabel(score: number): { label: string; tone: 'high' | 'medium' | 'low' } {
  if (score >= 14) return { label: 'Prime suspect', tone: 'high' }
  if (score >= 8) return { label: 'Strong suspicion', tone: 'medium' }
  if (score >= 4) return { label: 'Person of interest', tone: 'low' }
  return { label: 'Low signal', tone: 'low' }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SuspectCard({
  person,
  rank,
  maxScore,
  onFocusMap,
  onFocusRoute,
}: {
  person: Person
  rank: number
  maxScore: number
  onFocusMap: (personId: string) => void
  onFocusRoute: (personId: string) => void
}) {
  const [expanded, setExpanded] = useState(rank === 1)
  const { label, tone } = suspicionLabel(person.suspicionScore)
  const pct = maxScore > 0 ? Math.round((person.suspicionScore / maxScore) * 100) : 0

  return (
    <div
      className={[
        'border transition-shadow',
        rank === 1
          ? 'border-accent bg-accent-soft/30'
          : 'border-border bg-surface-raised hover:shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 p-4">
        {/* rank badge */}
        <span
          className={[
            'w-7 h-7 grid place-items-center text-[11px] font-bold shrink-0',
            rank <= 3
              ? 'bg-accent text-white'
              : 'bg-surface border border-border text-ink-muted',
          ].join(' ')}
        >
          {rank}
        </span>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink truncate">{person.displayName}</span>
            <span
              className={[
                'case-stamp',
                tone === 'high'
                  ? 'text-accent-ink'
                  : tone === 'medium'
                    ? 'text-warning'
                    : 'text-ink-muted',
              ].join(' ')}
            >
              {label}
            </span>
          </div>

          {/* progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border/50 overflow-hidden">
              <div
                className={[
                  'h-full transition-[width] duration-700',
                  rank === 1 ? 'bg-accent' : 'bg-ink-muted',
                ].join(' ')}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="meta-mono shrink-0 w-14 text-right">
              {person.suspicionScore} pts
            </span>
          </div>
        </div>

        {/* expand/collapse button */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 meta-mono uppercase tracking-wider text-accent hover:text-accent-ink underline underline-offset-4 cursor-pointer"
          aria-expanded={expanded}
        >
          {expanded ? '- hide' : '+ breakdown'}
        </button>
      </div>

      {/* expanded breakdown */}
      {expanded && (
        <div className="border-t border-border bg-surface/50 p-4">
          <ul className="flex flex-col gap-1.5 mb-3">
            {person.suspicionReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-ink-muted">
                <span className="text-accent shrink-0 mt-px">--</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="meta-mono">{person.recordCount} records</span>
            <span className="meta-mono">{person.locations.length} locations</span>
            {person.aliases.length > 1 && (
              <span className="meta-mono">{person.aliases.length} aliases</span>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => onFocusRoute(person.id)}
              className="meta-mono uppercase tracking-wider text-accent hover:text-accent-ink underline underline-offset-4 cursor-pointer"
            >
              view route
            </button>
            <button
              type="button"
              onClick={() => onFocusMap(person.id)}
              className="meta-mono uppercase tracking-wider text-accent hover:text-accent-ink underline underline-offset-4 cursor-pointer"
            >
              focus on map
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SuspectsLoaded({ model }: { model: InvestigationModel }) {
  const navigate = useNavigate()
  const suspects = useMemo(
    () => model.people.filter((p) => normalizeText(p.displayName) !== PODO_KEY && p.suspicionScore > 0),
    [model.people],
  )
  const maxScore = suspects[0]?.suspicionScore ?? 1
  const totalPoints = suspects.reduce((sum, p) => sum + p.suspicionScore, 0)

  const handleFocusMap = useCallback(
    (personId: string) => navigate(`/map?person=${personId}`),
    [navigate],
  )
  const handleFocusRoute = useCallback(
    (personId: string) => navigate(`/route?person=${personId}`),
    [navigate],
  )

  if (suspects.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No suspects scored"
          description="Not enough data to generate suspicion scores."
        />
      </div>
    )
  }

  const prime = suspects[0]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-8 px-6">
        {/* header */}
        <header className="mb-6">
          <span className="case-stamp">suspicion engine</span>
          <h1 className="display-serif text-2xl text-ink mt-2">Who took Podo?</h1>
          <p className="text-sm text-ink-muted mt-1">
            An algorithmic suspicion ranking built from co-location, co-mentions, anonymous tips, and last-seen proximity.
          </p>
          <span className="inline-block mt-2 meta-mono border border-border px-2 py-0.5">
            {suspects.length} ranked
          </span>
        </header>

        {/* prime suspect hero */}
        <div className="border-2 border-accent bg-accent-soft/20 p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 grid place-items-center text-lg font-bold text-white bg-accent shrink-0">
              {initials(prime.displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="case-stamp text-accent-ink">prime suspect</span>
              </div>
              <h2 className="display-serif text-2xl text-ink mt-1">{prime.displayName}</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {prime.suspicionReasons.slice(0, 2).map((r, i) => (
                  <li key={i} className="text-xs text-ink-muted flex items-start gap-1.5">
                    <span className="text-accent shrink-0">--</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0">
              <div className="display-serif text-4xl text-accent-ink">{prime.suspicionScore}</div>
              <div className="meta-mono uppercase">suspicion pts</div>
            </div>
          </div>
        </div>

        {/* full ranked list */}
        <div className="flex flex-col gap-0 mb-6">
          {suspects.map((person, i) => (
            <SuspectCard
              key={person.id}
              person={person}
              rank={i + 1}
              maxScore={maxScore}
              onFocusMap={handleFocusMap}
              onFocusRoute={handleFocusRoute}
            />
          ))}
        </div>

        {/* scoring methodology */}
        <div className="border border-dashed border-border bg-surface p-3 meta-mono text-ink-muted">
          <span className="font-semibold text-ink">Heuristic scoring.</span>{' '}
          Co-location with Podo = 2-4 pts/record (source weighted) |
          Named in anonymous tip = 2-6 pts (confidence weighted) |
          Late-stage proximity = 3-5 pts |
          Secrecy language = 2 pts/hit |
          Lure messages = 2 pts/hit |
          Multi-location trail = 2 pts.
          <span className="block mt-1">
            {suspects.length} suspect{suspects.length === 1 ? '' : 's'} | {totalPoints} total pts distributed
          </span>
        </div>
      </div>
    </div>
  )
}

export function SuspectsPage() {
  const { status, model, error, reload } = useCaseData()

  if (status === 'loading') {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <SkeletonStack count={8} rowHeight="72px" />
      </div>
    )
  }
  if (status === 'error' || !model) {
    return (
      <div className="p-8">
        <ErrorCard
          title="Could not load case records"
          message={error ?? 'Unknown error reaching Jotform.'}
          onRetry={reload}
        />
      </div>
    )
  }
  return <SuspectsLoaded model={model} />
}
