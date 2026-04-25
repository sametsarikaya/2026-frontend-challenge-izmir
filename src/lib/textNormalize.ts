export const TURKISH_COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function normalizeText(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function uniqueValues<T>(values: ReadonlyArray<T | null | undefined>): T[] {
  const seen = new Set<T>()
  const result: T[] = []
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function sortUnique(values: ReadonlyArray<string>): string[] {
  return uniqueValues(values).sort((left, right) => TURKISH_COLLATOR.compare(left, right))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
