import { useEffect, useRef } from 'react'

interface SearchInputProps {
  query: string
  resultCount: number | null
  onChange: (next: string) => void
}

export function SearchInput({ query, resultCount, onChange }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== '/') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <div className="relative flex items-center">
      <span aria-hidden="true" className="meta-mono absolute left-3 text-ink-subtle">
        ⌕
      </span>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search records, people, locations…"
        aria-label="Search records and people"
        className="w-full bg-bg border border-border rounded-sm pl-9 pr-20 py-2 text-sm text-ink placeholder:text-ink-subtle hover:border-border-strong focus-visible:border-accent"
      />
      <span className="meta-mono absolute right-3 text-ink-subtle pointer-events-none">
        {query ? `${resultCount ?? 0} hits` : 'press /'}
      </span>
    </div>
  )
}
