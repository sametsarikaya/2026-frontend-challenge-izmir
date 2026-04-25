import type { CaseHighlights, Person } from '@/types/domain'

interface HighlightCardsProps {
  highlights: CaseHighlights
  onSelectPerson: (personId: string) => void
  onSelectRecord: (recordId: string) => void
}

interface HighlightCardProps {
  stamp: string
  title: string
  subtitle: string
  detail: string
  onClick?: () => void
}

function HighlightCard({ stamp, title, subtitle, detail, onClick }: HighlightCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col items-start gap-2 p-4 border border-border bg-surface text-left hover:border-border-strong hover:bg-surface-raised disabled:cursor-default disabled:opacity-70 transition-colors min-w-0"
    >
      <span className="case-stamp">{stamp}</span>
      <p className="display-serif text-xl text-ink leading-tight truncate w-full">{title}</p>
      <p className="meta-mono w-full truncate">{subtitle}</p>
      <p className="text-xs text-ink-muted leading-snug line-clamp-3">{detail}</p>
    </button>
  )
}

function describeMostSuspicious(person: Person | null): HighlightCardProps {
  if (!person) {
    return {
      stamp: 'most suspicious',
      title: 'No suspect surfaced',
      subtitle: 'data unavailable',
      detail: 'Suspicion scoring needs at least one tip or sighting.',
    }
  }
  return {
    stamp: 'most suspicious',
    title: person.displayName,
    subtitle: `score ${person.suspicionScore} · ${person.recordCount} records`,
    detail:
      person.suspicionReasons.length > 0
        ? person.suspicionReasons[0]
        : 'No strong suspicious pattern stands out yet.',
  }
}

function describeLastSeenWith(person: Person | null): HighlightCardProps {
  if (!person) {
    return {
      stamp: 'last seen with',
      title: 'No corroborated pairing',
      subtitle: 'pending data',
      detail: 'Sightings or note evidence needed to anchor the last known pairing.',
    }
  }
  return {
    stamp: 'last seen with',
    title: person.displayName,
    subtitle: person.locations.slice(0, 2).join(' · ') || 'unknown location',
    detail: person.suspicionReasons[0] ?? person.matchSummary,
  }
}

export function HighlightCards({ highlights, onSelectPerson, onSelectRecord }: HighlightCardsProps) {
  const lastSeenProps = describeLastSeenWith(highlights.lastSeenWith)
  const mostSuspiciousProps = describeMostSuspicious(highlights.mostSuspicious)
  const latest = highlights.lastKnownRecord
  const latestProps: HighlightCardProps = latest
    ? {
        stamp: 'latest event',
        title: latest.title,
        subtitle: `${latest.sourceLabel} · ${latest.timestampLabel}`,
        detail: latest.location,
        onClick: () => onSelectRecord(latest.id),
      }
    : {
        stamp: 'latest event',
        title: 'Awaiting first record',
        subtitle: 'no submissions yet',
        detail: 'Once data arrives the most recent event will appear here.',
      }

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-border bg-bg">
      <HighlightCard
        {...lastSeenProps}
        onClick={highlights.lastSeenWith ? () => onSelectPerson(highlights.lastSeenWith!.id) : undefined}
      />
      <HighlightCard
        {...mostSuspiciousProps}
        onClick={
          highlights.mostSuspicious ? () => onSelectPerson(highlights.mostSuspicious!.id) : undefined
        }
      />
      <HighlightCard {...latestProps} />
    </section>
  )
}
