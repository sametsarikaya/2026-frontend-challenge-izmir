import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface AppShellProps {
  children: ReactNode
}

interface NavEntry {
  to: string
  label: string
}

const NAV_ENTRIES: ReadonlyArray<NavEntry> = [
  { to: '/', label: 'Dashboard' },
  { to: '/map', label: 'Map' },
  { to: '/route', label: 'Route Flow' },
]

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-full flex flex-col bg-bg text-ink">
      <header className="flex items-center justify-between gap-6 border-b border-border bg-surface-raised px-6 h-[var(--header-height)]">
        <div className="flex items-center gap-3">
          <span className="case-stamp">case board</span>
          <span className="meta-mono">file · missing-podo / izmir</span>
        </div>
        <nav aria-label="primary">
          <ul className="flex items-center gap-1 text-sm">
            {NAV_ENTRIES.map((entry) => (
              <li key={entry.to}>
                <NavLink
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) =>
                    [
                      'px-3 py-1.5 rounded-sm border border-transparent transition-colors',
                      isActive
                        ? 'border-accent text-accent-ink bg-accent-soft'
                        : 'text-ink-muted hover:text-ink',
                    ].join(' ')
                  }
                >
                  {entry.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
