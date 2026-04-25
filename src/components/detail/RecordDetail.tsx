import { useState } from 'react'
import type { CaseRecord, Person } from '@/types/domain'
import { EmptyState } from '@/components/feedback/EmptyState'

interface RecordDetailProps {
  record: CaseRecord | null
  recordsById: Map<string, CaseRecord>
  peopleById: Map<string, Person>
  onSelectRecord: (recordId: string) => void
  onSelectPerson: (personId: string) => void
}

export function RecordDetail({
  record,
  recordsById,
  peopleById,
  onSelectRecord,
  onSelectPerson,
}: RecordDetailProps) {
  const [showRaw, setShowRaw] = useState(false)

  if (!record) {
    return (
      <aside className="flex flex-col p-6 border-l border-border bg-bg min-h-0">
        <EmptyState
          title="Select a record"
          description="Pick any timeline entry to inspect actors, evidence and connections."
        />
      </aside>
    )
  }

  const relatedRecords = record.relatedRecordIds
    .map((id) => recordsById.get(id))
    .filter((value): value is CaseRecord => value !== undefined)
    .slice(0, 12)

  return (
    <aside className="flex flex-col gap-5 p-6 border-l border-border bg-bg min-h-0 overflow-y-auto">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="case-stamp">{record.sourceLabel}</span>
          {record.timestamp ? (
            <time dateTime={record.timestamp.toISOString()} className="meta-mono">
              {record.timestampLabel}
            </time>
          ) : null}
        </div>
        <h2 className="display-serif text-2xl text-ink leading-tight">{record.title}</h2>
        <p className="meta-mono">{record.location}</p>
      </header>

      {record.flags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {record.flags.map((flag) => (
            <li
              key={flag.label}
              className={[
                'meta-mono uppercase tracking-wider px-2 py-0.5 border',
                flag.tone === 'high'
                  ? 'border-accent text-accent-ink'
                  : flag.tone === 'medium'
                    ? 'border-warning text-warning'
                    : 'border-border text-ink-muted',
              ].join(' ')}
            >
              {flag.label}
            </li>
          ))}
        </ul>
      ) : null}

      {record.content ? (
        <section className="flex flex-col gap-2">
          <h3 className="meta-mono uppercase tracking-wider">Content</h3>
          <p className="text-ink leading-relaxed whitespace-pre-line text-sm">{record.content}</p>
        </section>
      ) : null}

      {record.actors.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="meta-mono uppercase tracking-wider">Actors</h3>
          <ul className="flex flex-col gap-1.5">
            {record.actors.map((actor) => {
              const person = peopleById.get(actor.personId)
              return (
                <li
                  key={`${actor.personId}-${actor.role}`}
                  className="flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onSelectPerson(actor.personId)}
                    className="text-left text-sm text-ink hover:text-accent-ink underline-offset-2 hover:underline"
                  >
                    {actor.label}
                    {actor.rawLabel !== actor.label ? (
                      <span className="meta-mono ml-2">({actor.rawLabel})</span>
                    ) : null}
                  </button>
                  <span className="meta-mono">
                    {actor.role}
                    {person ? ` · ${person.recordCount} rec` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {relatedRecords.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="meta-mono uppercase tracking-wider">
            Related evidence · {relatedRecords.length}
          </h3>
          <ul className="flex flex-col">
            {relatedRecords.map((related) => (
              <li key={related.id}>
                <button
                  type="button"
                  onClick={() => onSelectRecord(related.id)}
                  className="w-full text-left flex items-center justify-between gap-3 py-2 border-b border-border hover:bg-surface"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-ink truncate">{related.title}</span>
                    <span className="meta-mono truncate">
                      {related.sourceLabel} · {related.location}
                    </span>
                  </span>
                  <span className="meta-mono shrink-0">{related.timeLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowRaw((value) => !value)}
          className="meta-mono uppercase tracking-wider text-accent self-start hover:text-accent-ink underline underline-offset-4"
        >
          {showRaw ? '— hide raw record' : '+ show raw record'}
        </button>
        {showRaw ? (
          <pre className="meta-mono text-ink-muted bg-surface border border-border p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify({ id: record.id, ...record.rawValues }, null, 2)}
          </pre>
        ) : null}
      </section>
    </aside>
  )
}
