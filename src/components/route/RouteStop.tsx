import { useState } from 'react'
import type { RouteStop as RouteStopType } from '@/lib/routeReconstruction'
import type { SourceId } from '@/types/domain'

interface RouteStopProps {
  stop: RouteStopType
  index: number
  isLast: boolean
  onSelectRecord: (id: string) => void
}

const SOURCE_DOT: Record<SourceId, string> = {
  checkins: 'bg-ink-muted',
  messages: 'bg-ink-muted',
  sightings: 'bg-accent',
  notes: 'bg-ink-subtle',
  tips: 'bg-warning',
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RouteStopCard({ stop, index, isLast, onSelectRecord }: RouteStopProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex gap-3 relative">
      {/* vertical connector */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div className="w-7 h-7 rounded-full border-2 border-accent bg-accent-soft flex items-center justify-center">
          <span className="meta-mono text-accent-ink text-2xs font-bold">{index + 1}</span>
        </div>
        {!isLast && (
          <div className="flex-1 w-px bg-border-strong" style={{ minHeight: 24 }} />
        )}
      </div>

      {/* card */}
      <div className="flex-1 flex flex-col gap-1.5 pb-5 min-w-0">
        <h3 className="text-sm font-medium text-ink leading-tight">
          {stop.location || 'Unknown location'}
        </h3>
        <div className="meta-mono flex items-center gap-2 flex-wrap">
          <span>{formatTime(stop.firstTime)}</span>
          {stop.firstTime !== stop.lastTime && (
            <>
              <span className="text-ink-subtle">→</span>
              <span>{formatTime(stop.lastTime)}</span>
            </>
          )}
          <span className="text-ink-subtle">·</span>
          <span className="text-ink-subtle">{stop.durationLabel}</span>
        </div>

        {stop.peoplePresent.length > 0 && (
          <div className="meta-mono flex flex-wrap gap-1.5 mt-0.5">
            {stop.peoplePresent.map((name) => (
              <span
                key={name}
                className="px-1.5 py-0.5 border border-border text-ink-muted"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="meta-mono text-accent self-start hover:text-accent-ink underline underline-offset-4 mt-1"
        >
          {expanded
            ? `— hide ${stop.records.length} record${stop.records.length === 1 ? '' : 's'}`
            : `+ ${stop.records.length} record${stop.records.length === 1 ? '' : 's'}`}
        </button>

        {expanded && (
          <ul className="flex flex-col mt-1">
            {stop.records.map((rec) => (
              <li key={rec.id}>
                <button
                  type="button"
                  onClick={() => onSelectRecord(rec.id)}
                  className="w-full text-left flex items-center gap-2 py-1.5 border-b border-border hover:bg-surface transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${SOURCE_DOT[rec.sourceId]}`}
                  />
                  <span className="text-sm text-ink truncate">{rec.title}</span>
                  <span className="meta-mono shrink-0 ml-auto">{rec.timeLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
