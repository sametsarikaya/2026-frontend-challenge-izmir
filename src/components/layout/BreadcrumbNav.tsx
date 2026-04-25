interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface BreadcrumbNavProps {
  items: ReadonlyArray<BreadcrumbItem>
}

export function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  if (items.length === 0) return null
  const lastIndex = items.length - 1

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-2 px-5 py-2 border-b border-border bg-surface">
      <ol className="flex items-center gap-2 min-w-0">
        {items.map((item, index) => {
          const isLast = index === lastIndex
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2 min-w-0">
              {isLast ? (
                <span aria-current="page" className="meta-mono text-ink truncate">
                  {item.label}
                </span>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="meta-mono text-ink-muted hover:text-ink underline-offset-4 hover:underline truncate"
                >
                  {item.label}
                </button>
              ) : (
                <span className="meta-mono text-ink-muted truncate">{item.label}</span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="meta-mono text-ink-subtle">
                  /
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
