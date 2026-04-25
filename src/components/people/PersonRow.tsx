import { memo, useState } from 'react'
import type { Person } from '@/types/domain'

interface PersonRowProps {
  person: Person
  active: boolean
  onSelect: (personId: string) => void
}

const SUSPICION_TONE: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-border text-ink-muted',
  medium: 'border-warning text-warning',
  high: 'border-accent text-accent-ink bg-accent-soft',
}

function suspicionTone(score: number): keyof typeof SUSPICION_TONE {
  if (score >= 14) return 'high'
  if (score >= 8) return 'medium'
  return 'low'
}

function PersonRowComponent({ person, active, onSelect }: PersonRowProps) {
  const [expanded, setExpanded] = useState(false)
  const tone = suspicionTone(person.suspicionScore)

  return (
    <li
      className={[
        'flex flex-col gap-1.5 px-4 py-3 border-b border-border cursor-pointer',
        active ? 'bg-accent-soft' : 'hover:bg-surface',
      ].join(' ')}
      onClick={() => onSelect(person.id)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <p className="text-sm text-ink font-medium truncate">{person.displayName}</p>
          <p className="meta-mono truncate">
            {person.recordCount} record{person.recordCount === 1 ? '' : 's'} ·{' '}
            {person.aliases.length} alias{person.aliases.length === 1 ? '' : 'es'}
          </p>
        </div>
        <span
          className={[
            'meta-mono uppercase tracking-wider px-2 py-0.5 border',
            SUSPICION_TONE[tone],
          ].join(' ')}
          aria-label={`Suspicion score ${person.suspicionScore}`}
        >
          {person.suspicionScore}
        </span>
      </div>
      {person.suspicionReasons.length > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
          className="meta-mono text-ink-subtle text-left hover:text-ink"
        >
          {expanded ? '— hide signals' : `+ why · ${person.suspicionReasons.length}`}
        </button>
      ) : null}
      {expanded ? (
        <ul className="flex flex-col gap-1 pl-2 border-l border-border">
          {person.suspicionReasons.map((reason, index) => (
            <li key={index} className="meta-mono text-ink-muted leading-snug">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export const PersonRow = memo(PersonRowComponent)
