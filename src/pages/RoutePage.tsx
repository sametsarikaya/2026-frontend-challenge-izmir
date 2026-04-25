import { EmptyState } from '@/components/feedback/EmptyState'

export function RoutePage() {
  return (
    <section className="flex flex-col gap-4 p-8 max-w-3xl">
      <span className="case-stamp">route flow</span>
      <h1 className="display-serif text-3xl text-ink leading-tight">Podo route reconstruction</h1>
      <EmptyState
        title="Route reconstruction lands in the next phase"
        description="Stop-by-stop chronological route line with per-stop evidence comes in Phase 5."
      />
    </section>
  )
}
