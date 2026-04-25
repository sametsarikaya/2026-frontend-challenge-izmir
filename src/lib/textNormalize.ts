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

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = new Array<number>(right.length + 1).fill(0)

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    for (let k = 0; k < current.length; k += 1) {
      previous[k] = current[k]
    }
  }
  return previous[right.length]
}

export function stringSimilarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1
  const distance = levenshteinDistance(left, right)
  const longest = Math.max(left.length, right.length)
  return longest === 0 ? 1 : 1 - distance / longest
}
