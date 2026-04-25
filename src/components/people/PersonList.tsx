import type { Person } from '@/types/domain'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PersonRow } from './PersonRow'

interface PersonListProps {
  people: ReadonlyArray<Person>
  selectedPersonId: string | null
  onSelect: (personId: string) => void
}

export function PersonList({ people, selectedPersonId, onSelect }: PersonListProps) {
  if (people.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="No people resolved yet"
          description="Person profiles appear here once records are loaded and identities are merged."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      <header className="flex items-baseline justify-between gap-2 px-4 py-3 border-b border-border">
        <span className="case-stamp">people</span>
        <span className="meta-mono">{people.length}</span>
      </header>
      <ul className="flex-1 min-h-0 overflow-y-auto">
        {people.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            active={person.id === selectedPersonId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}
