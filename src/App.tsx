import { AppShell } from './components/layout/AppShell'
import { useCaseData } from './hooks/useCaseData'

function StatusLine() {
  const { status, model, error, sourceErrors } = useCaseData()

  if (status === 'loading') {
    return <p className="meta-mono">phase · 2 — fetching case data…</p>
  }
  if (status === 'error') {
    return <p className="meta-mono text-danger">phase · 2 — error: {error ?? 'unknown'}</p>
  }
  if (!model) {
    return <p className="meta-mono">phase · 2 — no model</p>
  }

  return (
    <p className="meta-mono">
      phase · 2 — {model.records.length} records · {model.people.length} people ·{' '}
      {model.sourceSummary.loaded}/{model.sourceSummary.total} sources loaded
      {sourceErrors.length > 0 ? ` · ${sourceErrors.length} source warning(s)` : ''}
    </p>
  )
}

function App() {
  return (
    <AppShell>
      <section className="flex flex-col items-start gap-4 px-8 py-12 max-w-3xl">
        <span className="case-stamp">case file · in progress</span>
        <h1 className="font-serif text-3xl text-ink leading-tight">
          Missing Podo — live investigation board
        </h1>
        <p className="text-ink-muted max-w-prose">
          Five case streams will be merged into one chronological trail. Data layer is wired;
          dashboard, map, and route reconstruction land in subsequent phases.
        </p>
        <StatusLine />
      </section>
    </AppShell>
  )
}

export default App
