import { memo } from 'react'
import type { CaseRecord, SourceId } from '@/types/domain'

interface TimelineEntryProps {
  record: CaseRecord
  active: boolean
  onSelect: (recordId: string) => void
}

const SOURCE_BADGE_TONE: Record<SourceId, string> = {
  checkins: 'border-border-strong text-ink',
  messages: 'border-border-strong text-ink',
  sightings: 'border-accent text-accent-ink',
  notes: 'border-border-strong text-ink-muted',
  tips: 'border-warning text-warning',
}

function FlagPill({ label, tone }: { label: string; tone: 'low' | 'medium' | 'high' }) {
  const className =
    tone === 'high'
      ? 'border-accent text-accent-ink'
      : tone === 'medium'
        ? 'border-warning text-warning'
        : 'border-border text-ink-muted'
  return (
    <span className={`meta-mono uppercase tracking-wider px-1.5 py-0.5 border ${className}`}>
      {label}
    </span>
  )
}

function TimelineEntryComponent({ record, active, onSelect }: TimelineEntryProps) {
  return (
    <article
      onClick={() => onSelect(record.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(record.id)
        }
      }}
      className={[
        'flex flex-col gap-2 px-5 py-4 border-b border-border cursor-pointer transition-colors',
        active ? 'bg-accent-soft' : 'hover:bg-surface',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`meta-mono uppercase tracking-wider px-1.5 py-0.5 border ${SOURCE_BADGE_TONE[record.sourceId]}`}
          >
            {record.sourceLabel}
          </span>
          {record.timestamp ? (
            <time dateTime={record.timestamp.toISOString()} className="meta-mono">
              {record.timeLabel}
            </time>
          ) : (
            <span className="meta-mono">no time</span>
          )}
        </div>
        {record.actors.length > 0 ? (
          <span className="meta-mono">
            {record.actors.length} actor{record.actors.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <p className="text-ink text-sm font-medium leading-snug">{record.title}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="meta-mono truncate">{record.location}</p>
        {record.flags.length > 0 ? (
          <div className="flex gap-1.5 shrink-0">
            {record.flags.map((flag) => (
              <FlagPill key={flag.label} label={flag.label} tone={flag.tone} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export const TimelineEntry = memo(TimelineEntryComponent)
