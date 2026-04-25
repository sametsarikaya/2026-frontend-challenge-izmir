import type { CaseRecord, Geo, InvestigationModel, Person } from '@/types/domain'

export interface RouteStop {
  location: string
  geo: Geo | null
  records: CaseRecord[]
  firstTime: number
  lastTime: number
  durationLabel: string
  peoplePresent: string[]
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'instant'
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `~${mins} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `~${hrs} hr${hrs === 1 ? '' : 's'}`
  const days = Math.round(hrs / 24)
  return `~${days} day${days === 1 ? '' : 's'}`
}

export function reconstructRoute(
  person: Person,
  model: InvestigationModel,
): RouteStop[] {
  const records = person.recordIds
    .map((id) => model.recordsById.get(id))
    .filter((r): r is CaseRecord => r !== undefined && r.sortTime > 0)
    .sort((a, b) => a.sortTime - b.sortTime)

  if (records.length === 0) return []

  const stops: RouteStop[] = []
  let currentGroup: CaseRecord[] = [records[0]]

  for (let i = 1; i < records.length; i++) {
    const rec = records[i]
    const prev = currentGroup[currentGroup.length - 1]
    if (rec.location === prev.location) {
      currentGroup.push(rec)
    } else {
      stops.push(buildStop(currentGroup, model))
      currentGroup = [rec]
    }
  }
  stops.push(buildStop(currentGroup, model))

  return stops
}

function buildStop(group: CaseRecord[], model: InvestigationModel): RouteStop {
  const firstTime = group[0].sortTime
  const lastTime = group[group.length - 1].sortTime
  const geo = group.find((r) => r.geo !== null)?.geo ?? null

  const peopleSet = new Set<string>()
  for (const rec of group) {
    for (const actor of rec.actors) {
      const person = model.peopleById.get(actor.personId)
      if (person) peopleSet.add(person.displayName)
    }
  }

  return {
    location: group[0].location,
    geo,
    records: group,
    firstTime,
    lastTime,
    durationLabel: firstTime === lastTime ? 'single event' : formatDuration(lastTime - firstTime),
    peoplePresent: [...peopleSet].sort(),
  }
}
