const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

const TIMESTAMP_PATTERN = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/

export function parseTimestamp(rawValue: string | undefined): Date | null {
  if (!rawValue) return null
  const match = rawValue.trim().match(TIMESTAMP_PATTERN)
  if (!match) return null

  const [, day, month, year, hour, minute] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(date: Date | null): string {
  if (!date) return 'Time unknown'
  return DATE_TIME_FORMATTER.format(date)
}

export function formatClock(date: Date | null): string {
  if (!date) return 'No time'
  return CLOCK_FORMATTER.format(date)
}
