interface ErrorCardProps {
  title: string
  message: string
  onRetry?: () => void
}

export function ErrorCard({ title, message, onRetry }: ErrorCardProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 border border-accent/40 bg-accent-soft/40 px-5 py-4"
    >
      <span className="case-stamp">case error</span>
      <p className="text-ink text-base font-medium">{title}</p>
      <p className="text-ink-muted text-sm">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="meta-mono uppercase tracking-wider text-accent hover:text-accent-ink underline underline-offset-4 mt-1"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
