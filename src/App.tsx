import { AppShell } from './components/layout/AppShell'

function App() {
  return (
    <AppShell>
      <section className="flex flex-col items-start gap-4 px-8 py-12 max-w-3xl">
        <span className="case-stamp">case file · in progress</span>
        <h1 className="font-serif text-3xl text-ink leading-tight">
          Missing Podo — live investigation board
        </h1>
        <p className="text-ink-muted max-w-prose">
          Five case streams will be merged into one chronological trail. Data layer, dashboard,
          map, and route reconstruction land in subsequent phases.
        </p>
        <p className="meta-mono">phase · 1 — bootstrap</p>
      </section>
    </AppShell>
  )
}

export default App
