import { EmptyState } from '@/components/feedback/EmptyState'

export function MapPage() {
  return (
    <section className="flex flex-col gap-4 p-8 max-w-3xl">
      <span className="case-stamp">map view</span>
      <h1 className="display-serif text-3xl text-ink leading-tight">Investigation map</h1>
      <EmptyState
        title="Map lands in the next phase"
        description="Clustered markers, list ↔ map sync and route overlays arrive in Phase 5."
      />
    </section>
  )
}
