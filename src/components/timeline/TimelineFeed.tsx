import { useMemo } from 'react'
import { GroupedVirtuoso } from 'react-virtuoso'
import type { CaseRecord } from '@/types/domain'
import { EmptyState } from '@/components/feedback/EmptyState'
import { TimelineEntry } from './TimelineEntry'

interface TimelineFeedProps {
  records: ReadonlyArray<CaseRecord>
  selectedRecordId: string | null
  onSelect: (recordId: string) => void
}

interface DayGroup {
  label: string
  count: number
  startIndex: number
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

function dayLabel(record: CaseRecord): string {
  if (!record.timestamp) return 'Time unknown'
  return DAY_FORMATTER.format(record.timestamp)
}

function groupByDay(records: ReadonlyArray<CaseRecord>): DayGroup[] {
  const groups: DayGroup[] = []
  let currentLabel: string | null = null
  records.forEach((record, index) => {
    const label = dayLabel(record)
    if (label !== currentLabel) {
      groups.push({ label, count: 1, startIndex: index })
      currentLabel = label
    } else {
      groups[groups.length - 1].count += 1
    }
  })
  return groups
}

export function TimelineFeed({ records, selectedRecordId, onSelect }: TimelineFeedProps) {
  const groups = useMemo(() => groupByDay(records), [records])
  const groupCounts = useMemo(() => groups.map((group) => group.count), [groups])

  if (records.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No records match the current filters"
          description="Loosen a filter or clear all to see the full investigation timeline."
        />
      </div>
    )
  }

  return (
    <GroupedVirtuoso
      groupCounts={groupCounts}
      groupContent={(groupIndex) => (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-surface border-y border-border">
          <span className="case-stamp">{groups[groupIndex].label}</span>
          <span className="meta-mono">{groups[groupIndex].count}</span>
        </div>
      )}
      itemContent={(itemIndex) => {
        const record = records[itemIndex]
        return (
          <TimelineEntry
            record={record}
            active={record.id === selectedRecordId}
            onSelect={onSelect}
          />
        )
      }}
      style={{ height: '100%' }}
    />
  )
}
