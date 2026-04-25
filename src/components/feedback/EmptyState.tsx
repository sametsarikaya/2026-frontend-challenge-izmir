import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  hint?: ReactNode
}

export function EmptyState({ title, description, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-2 px-6 py-10 border border-dashed border-border bg-bg">
      <span className="meta-mono">no records</span>
      <p className="text-ink text-base font-medium">{title}</p>
      {description ? <p className="text-ink-muted max-w-prose">{description}</p> : null}
      {hint ? <div className="meta-mono text-ink-subtle">{hint}</div> : null}
    </div>
  )
}
