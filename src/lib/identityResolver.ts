import type {
  AliasMatchDetail,
  ConfidenceTone,
  Person,
  RawActor,
  ResolvedActor,
  SourceCount,
  SourceId,
  UncertainMatch,
} from '@/types/domain'
import type { NormalizedSubmission } from './normalizers'
import { TURKISH_COLLATOR, clamp, normalizeText, sortUnique, uniqueValues } from './textNormalize'

const MERGE_THRESHOLD = 72
const UNCERTAIN_THRESHOLD = 60
const STRONG_EDGE_THRESHOLD = 66

const GENERIC_ALIAS_KEYS = new Set<string>([
  'anonymous',
  'anonim',
  'event staff',
  'staff',
  'someone',
  'unknown',
])

interface AliasProfile {
  aliasKey: string
  tokens: string[]
  rawLabels: Map<string, number>
  recordIds: Set<string>
  locations: Set<string>
  locationKeys: Set<string>
  sourceIds: Set<SourceId>
  sourceCounts: Map<SourceId, number>
  roles: Set<RawActor['role']>
  coAliasKeys: Set<string>
  observations: Array<{ locationKey: string; sortTime: number }>
  mentionCount: number
}

interface PairScore {
  leftIndex: number
  rightIndex: number
  score: number
  nameScore: number
  contextScore: number
  decision: 'merge' | 'uncertain' | 'reject'
  hardConflict: boolean
  reasons: string[]
}

interface PairScoreData {
  edges: PairScore[]
  lookup: Map<string, PairScore>
}

interface ResolverInputRecord {
  id: string
  sourceId: SourceId
  location: string
  sortTime: number
  rawActors: RawActor[]
}

export type ResolverInputView = Pick<NormalizedSubmission, 'id' | 'sourceId' | 'location' | 'sortTime' | 'rawActors'>

export interface ResolvedRecord {
  id: string
  actors: ResolvedActor[]
  personIds: string[]
}

export interface IdentityResolution {
  people: Person[]
  peopleById: Map<string, Person>
  resolvedRecords: ResolvedRecord[]
}

function locationKey(value: string): string {
  return normalizeText(value)
}

function meaningfulTokens(tokens: ReadonlyArray<string>): string[] {
  return tokens.filter((token) => token.length > 1)
}

function firstToken(profile: AliasProfile): string {
  return profile.tokens[0] ?? ''
}

function lastToken(profile: AliasProfile): string {
  return profile.tokens[profile.tokens.length - 1] ?? ''
}

function isInitialToken(token: string): boolean {
  return token.length === 1
}

function hasFullFirstName(profile: AliasProfile): boolean {
  return firstToken(profile).length > 1
}

function hasFullLastName(profile: AliasProfile): boolean {
  return profile.tokens.length > 1 && lastToken(profile).length > 1
}

function levenshteinDistance(left: string, right: string): number {
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

function stringSimilarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1
  const distance = levenshteinDistance(left, right)
  const longest = Math.max(left.length, right.length)
  return longest === 0 ? 1 : 1 - distance / longest
}

function prefixCompatible(left: string, right: string): boolean {
  if (!left || !right) return false
  const shorter = left.length <= right.length ? left : right
  const longer = shorter === left ? right : left
  return shorter.length >= 3 && longer.startsWith(shorter)
}

function initialCompatible(left: string, right: string): boolean {
  if (!left || !right) return false
  return (isInitialToken(left) && right.startsWith(left)) || (isInitialToken(right) && left.startsWith(right))
}

function tokenCompatible(left: string, right: string, threshold = 0.88): boolean {
  return (
    left === right ||
    prefixCompatible(left, right) ||
    initialCompatible(left, right) ||
    stringSimilarity(left, right) >= threshold
  )
}

function tokenOverlapRatio(leftTokens: ReadonlyArray<string>, rightTokens: ReadonlyArray<string>): number {
  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const overlap = [...leftSet].filter((token) => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size
  return union === 0 ? 0 : overlap / union
}

function intersectionSize<T>(left: Iterable<T>, right: Iterable<T>): number {
  const rightSet = right instanceof Set ? right : new Set(right)
  let count = 0
  for (const value of left) {
    if (rightSet.has(value)) count += 1
  }
  return count
}

function aliasRichness(rawLabel: string): number {
  const normalized = normalizeText(rawLabel)
  const tokens = normalized.split(' ').filter(Boolean)
  return meaningfulTokens(tokens).length * 24 + normalized.length - tokens.filter(isInitialToken).length * 8
}

function pickPreferredAlias(rawLabels: Map<string, number>): string {
  const entries = [...rawLabels.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1]
    const richnessGap = aliasRichness(right[0]) - aliasRichness(left[0])
    if (richnessGap !== 0) return richnessGap
    return TURKISH_COLLATOR.compare(left[0], right[0])
  })
  return entries[0]?.[0] ?? ''
}

function isGenericAlias(profile: AliasProfile): boolean {
  return GENERIC_ALIAS_KEYS.has(profile.aliasKey)
}

function oneUsesTrailingInitial(left: AliasProfile, right: AliasProfile): boolean {
  const leftLast = lastToken(left)
  const rightLast = lastToken(right)
  return (
    firstToken(left) === firstToken(right) &&
    ((left.tokens.length === 1 && right.tokens.length === 2 && isInitialToken(rightLast)) ||
      (right.tokens.length === 1 && left.tokens.length === 2 && isInitialToken(leftLast)))
  )
}

function oneUsesLeadingInitial(left: AliasProfile, right: AliasProfile): boolean {
  return (
    hasFullLastName(left) &&
    hasFullLastName(right) &&
    lastToken(left) === lastToken(right) &&
    initialCompatible(firstToken(left), firstToken(right))
  )
}

function nearbyObservationSupport(left: AliasProfile, right: AliasProfile): boolean {
  return left.observations.some((leftObs) => {
    if (!leftObs.sortTime) return false
    return right.observations.some(
      (rightObs) =>
        rightObs.sortTime &&
        leftObs.locationKey === rightObs.locationKey &&
        Math.abs(leftObs.sortTime - rightObs.sortTime) <= 60 * 60 * 1000,
    )
  })
}

function buildReasonList(reasons: ReadonlyArray<string>): string[] {
  return sortUnique(reasons).slice(0, 4)
}

function createAliasProfile(aliasKey: string): AliasProfile {
  return {
    aliasKey,
    tokens: aliasKey.split(' ').filter(Boolean),
    rawLabels: new Map(),
    recordIds: new Set(),
    locations: new Set(),
    locationKeys: new Set(),
    sourceIds: new Set(),
    sourceCounts: new Map(),
    roles: new Set(),
    coAliasKeys: new Set(),
    observations: [],
    mentionCount: 0,
  }
}

function buildObservationProfiles(records: ReadonlyArray<ResolverInputRecord>): AliasProfile[] {
  const profiles = new Map<string, AliasProfile>()

  records.forEach((record) => {
    const aliasKeys = record.rawActors.map((actor) => normalizeText(actor.label))

    record.rawActors.forEach((actor, index) => {
      const rawLabel = actor.label.trim()
      const aliasKey = aliasKeys[index]
      if (!aliasKey) return

      let profile = profiles.get(aliasKey)
      if (!profile) {
        profile = createAliasProfile(aliasKey)
        profiles.set(aliasKey, profile)
      }

      profile.mentionCount += 1
      profile.rawLabels.set(rawLabel, (profile.rawLabels.get(rawLabel) ?? 0) + 1)
      profile.recordIds.add(record.id)
      profile.locations.add(record.location)
      profile.locationKeys.add(locationKey(record.location))
      profile.sourceIds.add(record.sourceId)
      profile.sourceCounts.set(record.sourceId, (profile.sourceCounts.get(record.sourceId) ?? 0) + 1)
      profile.roles.add(actor.role)
      profile.observations.push({
        locationKey: locationKey(record.location),
        sortTime: record.sortTime,
      })

      aliasKeys.forEach((otherKey, otherIndex) => {
        if (!otherKey || otherIndex === index || otherKey === aliasKey) return
        profile.coAliasKeys.add(otherKey)
      })
    })
  })

  return [...profiles.values()].sort((left, right) => TURKISH_COLLATOR.compare(left.aliasKey, right.aliasKey))
}

function scoreNameProfiles(left: AliasProfile, right: AliasProfile): {
  nameScore: number
  hardConflict: boolean
  reasons: string[]
} {
  if (left.aliasKey === right.aliasKey) {
    return { nameScore: 100, hardConflict: false, reasons: ['Normalized name forms are identical.'] }
  }
  if (isGenericAlias(left) || isGenericAlias(right)) {
    return { nameScore: 0, hardConflict: true, reasons: [] }
  }

  const reasons: string[] = []
  let nameScore = 0
  let hardConflict = false
  const fullSimilarity = stringSimilarity(left.aliasKey, right.aliasKey)
  const firstCompatible = tokenCompatible(firstToken(left), firstToken(right), 0.9)
  const lastCompatible = tokenCompatible(lastToken(left), lastToken(right), 0.92)
  const overlapRatio = tokenOverlapRatio(meaningfulTokens(left.tokens), meaningfulTokens(right.tokens))
  const initialsMatch =
    left.tokens.map((token) => token[0]).join('') === right.tokens.map((token) => token[0]).join('')

  if (hasFullLastName(left) && hasFullLastName(right) && firstCompatible && lastCompatible) {
    nameScore += 56
    reasons.push('First and last name tokens line up.')
  } else if (oneUsesLeadingInitial(left, right)) {
    nameScore += 54
    reasons.push('Surname and first initial line up.')
  } else if (oneUsesTrailingInitial(left, right)) {
    nameScore += 52
    reasons.push('One record uses a trailing initial for the same first name.')
  } else if (left.tokens.length === 1 && right.tokens.length === 1 && fullSimilarity >= 0.88) {
    nameScore += 50
    reasons.push('Single-name spellings are very similar.')
  } else if (firstCompatible && !hasFullLastName(left) && !hasFullLastName(right)) {
    nameScore += 24
    reasons.push('Single-name forms look similar.')
  } else if (firstCompatible && (left.tokens.length === 1 || right.tokens.length === 1)) {
    nameScore += 22
    reasons.push('One record uses a partial form of the same first name.')
  }

  if (fullSimilarity >= 0.94) {
    nameScore += 24
    reasons.push('Overall spelling is nearly identical.')
  } else if (fullSimilarity >= 0.86) {
    nameScore += 16
    reasons.push('Overall spelling is close.')
  } else if (fullSimilarity >= 0.78) {
    nameScore += 8
    reasons.push('Only a small spelling difference is present.')
  }

  if (overlapRatio >= 0.5) {
    nameScore += 12
    reasons.push('Name tokens overlap strongly.')
  }

  if (initialsMatch && left.tokens.length > 1 && right.tokens.length > 1) {
    nameScore += 8
    reasons.push('Initial patterns match.')
  }

  if (hasFullLastName(left) && hasFullLastName(right) && !lastCompatible) {
    nameScore -= 32
    hardConflict = true
  }
  if (hasFullFirstName(left) && hasFullFirstName(right) && !firstCompatible && lastCompatible) {
    nameScore -= 12
  }
  if (left.tokens.length === 1 && right.tokens.length === 1 && Math.max(left.aliasKey.length, right.aliasKey.length) <= 3 && fullSimilarity < 0.95) {
    nameScore -= 20
  }
  if (overlapRatio === 0 && fullSimilarity < 0.7) {
    nameScore -= 18
  }

  return {
    nameScore: clamp(nameScore, 0, 100),
    hardConflict,
    reasons: buildReasonList(reasons),
  }
}

function scoreContextSignals(left: AliasProfile, right: AliasProfile): {
  contextScore: number
  reasons: string[]
} {
  const reasons: string[] = []
  let contextScore = 0
  const sharedLocations = intersectionSize(left.locationKeys, right.locationKeys)
  const sharedCoPeople = intersectionSize(left.coAliasKeys, right.coAliasKeys)
  const sharedSources = intersectionSize(left.sourceIds, right.sourceIds)

  if (sharedLocations > 0) {
    contextScore += Math.min(sharedLocations * 6, 12)
    reasons.push('The records share locations.')
  }
  if (sharedCoPeople > 0) {
    contextScore += Math.min(sharedCoPeople * 5, 10)
    reasons.push('The records repeatedly involve the same people.')
  }
  if (nearbyObservationSupport(left, right)) {
    contextScore += 8
    reasons.push('The records appear close in time at the same place.')
  }
  if (sharedSources > 1 && sharedLocations > 0) {
    contextScore += 4
    reasons.push('The overlap appears in more than one source type.')
  }

  return { contextScore, reasons: buildReasonList(reasons) }
}

function scoreAliasPair(left: AliasProfile, right: AliasProfile): Omit<PairScore, 'leftIndex' | 'rightIndex'> {
  const nameSignals = scoreNameProfiles(left, right)
  const contextSignals = scoreContextSignals(left, right)
  const score = clamp(nameSignals.nameScore + contextSignals.contextScore, 0, 100)
  let decision: PairScore['decision']
  if (score >= MERGE_THRESHOLD && (nameSignals.nameScore >= 54 || contextSignals.contextScore >= 20)) {
    decision = 'merge'
  } else if (score >= UNCERTAIN_THRESHOLD && nameSignals.nameScore >= 36) {
    decision = 'uncertain'
  } else {
    decision = 'reject'
  }

  return {
    score,
    nameScore: nameSignals.nameScore,
    contextScore: contextSignals.contextScore,
    decision,
    hardConflict: nameSignals.hardConflict,
    reasons: buildReasonList([...nameSignals.reasons, ...contextSignals.reasons]),
  }
}

function pairKey(leftIndex: number, rightIndex: number): string {
  return leftIndex < rightIndex ? `${leftIndex}:${rightIndex}` : `${rightIndex}:${leftIndex}`
}

function buildPairScores(profiles: ReadonlyArray<AliasProfile>): PairScoreData {
  const edges: PairScore[] = []
  const lookup = new Map<string, PairScore>()

  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const score = scoreAliasPair(profiles[i], profiles[j])
      const edge: PairScore = { leftIndex: i, rightIndex: j, ...score }
      lookup.set(pairKey(i, j), edge)
      edges.push(edge)
    }
  }

  return { edges: edges.sort((left, right) => right.score - left.score), lookup }
}

interface UnionFind {
  find: (index: number) => number
  union: (left: number, right: number) => number
}

function createUnionFind(size: number): UnionFind {
  const parent = Array.from({ length: size }, (_, index) => index)
  function find(index: number): number {
    if (parent[index] === index) return index
    parent[index] = find(parent[index])
    return parent[index]
  }
  function union(left: number, right: number): number {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot === rightRoot) return leftRoot
    parent[rightRoot] = leftRoot
    return leftRoot
  }
  return { find, union }
}

function bestCrossScore(
  clusterMembers: ReadonlyArray<number>,
  candidateMembers: ReadonlyArray<number>,
  scoreLookup: Map<string, PairScore>,
): number {
  return clusterMembers.reduce((bestScore, memberIndex) => {
    const memberBest = candidateMembers.reduce((currentBest, candidateIndex) => {
      const edge = scoreLookup.get(pairKey(memberIndex, candidateIndex))
      return Math.max(currentBest, edge?.score ?? 0)
    }, 0)
    return Math.min(bestScore, memberBest)
  }, Number.POSITIVE_INFINITY)
}

function canMergeClusters(
  leftMembers: ReadonlyArray<number>,
  rightMembers: ReadonlyArray<number>,
  scoreLookup: Map<string, PairScore>,
): boolean {
  const smaller = leftMembers.length <= rightMembers.length ? leftMembers : rightMembers
  const larger = smaller === leftMembers ? rightMembers : leftMembers
  const minimumCrossScore = bestCrossScore(smaller, larger, scoreLookup)
  if (minimumCrossScore < STRONG_EDGE_THRESHOLD) return false

  return !leftMembers.some((leftIndex) =>
    rightMembers.some((rightIndex) => {
      const edge = scoreLookup.get(pairKey(leftIndex, rightIndex))
      return Boolean(edge?.hardConflict && edge.score < UNCERTAIN_THRESHOLD)
    }),
  )
}

interface ClusterEntry {
  index: number
  profile: AliasProfile
}

function buildClusters(
  profiles: ReadonlyArray<AliasProfile>,
  scoreData: PairScoreData,
): ClusterEntry[][] {
  const unionFind = createUnionFind(profiles.length)
  const clusterMembers = new Map<number, number[]>(
    profiles.map((_, index) => [index, [index]]),
  )

  scoreData.edges
    .filter((edge) => edge.decision === 'merge')
    .forEach((edge) => {
      const leftRoot = unionFind.find(edge.leftIndex)
      const rightRoot = unionFind.find(edge.rightIndex)
      if (leftRoot === rightRoot) return

      const leftMembers = clusterMembers.get(leftRoot) ?? [leftRoot]
      const rightMembers = clusterMembers.get(rightRoot) ?? [rightRoot]
      if (!canMergeClusters(leftMembers, rightMembers, scoreData.lookup)) return

      const mergedRoot = unionFind.union(leftRoot, rightRoot)
      const merged = [...leftMembers, ...rightMembers]
      clusterMembers.delete(leftRoot)
      clusterMembers.delete(rightRoot)
      clusterMembers.set(mergedRoot, merged)
    })

  const byRoot = new Map<number, ClusterEntry[]>()
  profiles.forEach((profile, index) => {
    const root = unionFind.find(index)
    const list = byRoot.get(root) ?? []
    list.push({ index, profile })
    byRoot.set(root, list)
  })

  return [...byRoot.values()]
}

function clusterConfidenceTone(internalEdges: ReadonlyArray<PairScore>): ConfidenceTone {
  if (internalEdges.length === 0) return 'high'
  const average = internalEdges.reduce((total, edge) => total + edge.score, 0) / internalEdges.length
  if (average >= 88) return 'high'
  if (average >= 78) return 'medium'
  return 'low'
}

function confidenceLabel(tone: ConfidenceTone): string {
  if (tone === 'high') return 'High confidence'
  if (tone === 'medium') return 'Medium confidence'
  return 'Low confidence'
}

function buildClusterAliasDetails(
  cluster: ReadonlyArray<ClusterEntry>,
  primaryEntry: ClusterEntry,
  scoreLookup: Map<string, PairScore>,
): AliasMatchDetail[] {
  return cluster
    .map(({ index, profile }) => {
      const displayAlias = pickPreferredAlias(profile.rawLabels)
      if (index === primaryEntry.index) {
        return {
          alias: displayAlias,
          confidenceLabel: 'Canonical form',
          mentionCount: profile.mentionCount,
          reasons: ['Chosen as the clearest and most frequent recorded form.'],
          score: 100,
          statusTone: 'high' as ConfidenceTone,
        }
      }

      const supportingEdges = cluster
        .filter((entry) => entry.index !== index)
        .map((entry) => scoreLookup.get(pairKey(index, entry.index)))
        .filter((edge): edge is PairScore => Boolean(edge))
        .sort((left, right) => right.score - left.score)
      const bestEdge = supportingEdges[0]
      const tone: ConfidenceTone =
        (bestEdge?.score ?? 0) >= 88 ? 'high' : (bestEdge?.score ?? 0) >= 78 ? 'medium' : 'low'

      return {
        alias: displayAlias,
        confidenceLabel: confidenceLabel(tone),
        mentionCount: profile.mentionCount,
        reasons: bestEdge?.reasons ?? ['Grouped by exact normalized match.'],
        score: bestEdge?.score ?? 100,
        statusTone: tone,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.mentionCount !== left.mentionCount) return right.mentionCount - left.mentionCount
      return TURKISH_COLLATOR.compare(left.alias, right.alias)
    })
}

function buildUncertainMatches(
  cluster: ReadonlyArray<ClusterEntry>,
  clusters: ReadonlyArray<ReadonlyArray<ClusterEntry>>,
  scoreLookup: Map<string, PairScore>,
): UncertainMatch[] {
  const clusterIndexes = new Set(cluster.map((entry) => entry.index))
  const result: UncertainMatch[] = []

  clusters.forEach((candidateCluster) => {
    const candidateIndexes = new Set(candidateCluster.map((entry) => entry.index))
    if ([...candidateIndexes].some((index) => clusterIndexes.has(index))) return

    const bestEdge = cluster
      .flatMap((leftEntry) =>
        candidateCluster.map((rightEntry) => scoreLookup.get(pairKey(leftEntry.index, rightEntry.index))),
      )
      .filter((edge): edge is PairScore => Boolean(edge))
      .filter((edge) => edge.decision === 'uncertain')
      .sort((left, right) => right.score - left.score)[0]

    if (!bestEdge) return
    const candidateDisplay = pickPreferredAlias(candidateCluster[0].profile.rawLabels)
    result.push({
      alias: candidateDisplay,
      confidenceLabel: confidenceLabel('low'),
      reasons: bestEdge.reasons,
      score: bestEdge.score,
      statusTone: 'low',
    })
  })

  return result.sort((left, right) => right.score - left.score).slice(0, 3)
}

function buildPersonId(displayName: string, usedIds: Set<string>): string {
  const baseId = normalizeText(displayName) || `person ${usedIds.size + 1}`
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId)
    return baseId
  }
  let counter = 2
  while (usedIds.has(`${baseId} ${counter}`)) counter += 1
  const resolvedId = `${baseId} ${counter}`
  usedIds.add(resolvedId)
  return resolvedId
}

function buildMatchSummary(
  displayName: string,
  aliases: ReadonlyArray<string>,
  matchReasons: ReadonlyArray<string>,
  uncertainMatches: ReadonlyArray<UncertainMatch>,
): string {
  if (aliases.length <= 1) {
    return `Only one recorded name form is attached to ${displayName} so far.`
  }
  const leadingReasons = matchReasons.slice(0, 2).map((reason) => reason.toLowerCase())
  const uncertaintyNote =
    uncertainMatches.length > 0
      ? ` ${uncertainMatches.length} close variant${uncertainMatches.length === 1 ? ' remains' : 's remain'} separate because the score stayed below the merge threshold.`
      : ''
  return `Merged ${aliases.length} recorded variants because ${leadingReasons.join(' and ')}.${uncertaintyNote}`
}

function aggregateReasons(edges: ReadonlyArray<PairScore>): string[] {
  return sortUnique(edges.flatMap((edge) => edge.reasons)).slice(0, 4)
}

function sortSourceBreakdown(
  entries: ReadonlyArray<SourceCount>,
  sourceOrder: Partial<Record<SourceId, number>>,
): SourceCount[] {
  return [...entries].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count
    return (sourceOrder[left.sourceId] ?? 0) - (sourceOrder[right.sourceId] ?? 0)
  })
}

function buildPeopleFromClusters(
  clusters: ReadonlyArray<ReadonlyArray<ClusterEntry>>,
  scoreLookup: Map<string, PairScore>,
): Person[] {
  const usedIds = new Set<string>()

  return clusters.map((cluster) => {
    const aliasCounts = new Map<string, number>()
    const locations = new Set<string>()
    const recordIds = new Set<string>()
    const sourceBreakdown = new Map<SourceId, number>()
    const internalEdges: PairScore[] = []

    cluster.forEach(({ profile }) => {
      profile.rawLabels.forEach((count, alias) => {
        aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + count)
      })
      profile.locations.forEach((location) => locations.add(location))
      profile.recordIds.forEach((recordId) => recordIds.add(recordId))
      profile.sourceCounts.forEach((count, sourceId) => {
        sourceBreakdown.set(sourceId, (sourceBreakdown.get(sourceId) ?? 0) + count)
      })
    })

    cluster.forEach((leftEntry, leftIndex) => {
      for (let rightIndex = leftIndex + 1; rightIndex < cluster.length; rightIndex += 1) {
        const edge = scoreLookup.get(pairKey(leftEntry.index, cluster[rightIndex].index))
        if (edge?.decision === 'merge') internalEdges.push(edge)
      }
    })

    const primaryAlias = pickPreferredAlias(aliasCounts)
    const primaryEntry =
      cluster.find(({ profile }) => pickPreferredAlias(profile.rawLabels) === primaryAlias) ?? cluster[0]
    const aliases = [...aliasCounts.keys()].sort((left, right) => TURKISH_COLLATOR.compare(left, right))
    const matchReasons = aggregateReasons(internalEdges)
    const uncertainMatches = buildUncertainMatches(cluster, clusters, scoreLookup)
    const matchConfidence = clusterConfidenceTone(internalEdges)
    const aliasDetails = buildClusterAliasDetails(cluster, primaryEntry, scoreLookup)
    const displayName = primaryAlias || primaryEntry.profile.aliasKey
    const id = buildPersonId(displayName, usedIds)

    return {
      id,
      displayName,
      aliases,
      aliasDetails,
      recordIds: [...recordIds].sort(),
      locations: [...locations].sort((left, right) => TURKISH_COLLATOR.compare(left, right)),
      matchConfidence,
      matchConfidenceLabel: confidenceLabel(matchConfidence),
      matchReasons:
        matchReasons.length > 0
          ? matchReasons
          : ['No fuzzy merge was needed because only one spelling was observed.'],
      matchSummary: buildMatchSummary(displayName, aliases, matchReasons, uncertainMatches),
      sourceBreakdown: [...sourceBreakdown.entries()].map(([sourceId, count]) => ({ sourceId, count })),
      uncertainMatches,
      recordCount: recordIds.size,
      suspicionScore: 0,
      suspicionReasons: [],
    }
  })
}

function buildAliasDetailLookup(person: Person): Map<string, AliasMatchDetail> {
  return new Map(person.aliasDetails.map((detail) => [normalizeText(detail.alias), detail]))
}

function resolveActorsForRecord(
  record: ResolverInputRecord,
  profileToPerson: Map<string, Person>,
): ResolvedActor[] {
  return record.rawActors
    .map((actor): ResolvedActor | null => {
      const rawLabel = actor.label.trim()
      const aliasKey = normalizeText(rawLabel)
      const person = profileToPerson.get(aliasKey)
      if (!person) return null
      const aliasDetail = buildAliasDetailLookup(person).get(aliasKey)
      return {
        label: person.displayName,
        rawLabel,
        role: actor.role,
        personId: person.id,
        aliasKey,
        resolutionConfidence: aliasDetail?.statusTone ?? person.matchConfidence,
        resolutionReasons: aliasDetail?.reasons ?? person.matchReasons,
      }
    })
    .filter((actor): actor is ResolvedActor => actor !== null)
}

export function resolveIdentities(
  records: ReadonlyArray<ResolverInputRecord>,
  sourceOrder: Partial<Record<SourceId, number>> = {},
): IdentityResolution {
  const profiles = buildObservationProfiles(records)
  const scoreData = buildPairScores(profiles)
  const clusters = buildClusters(profiles, scoreData)
  const people = buildPeopleFromClusters(clusters, scoreData.lookup).map((person) => ({
    ...person,
    sourceBreakdown: sortSourceBreakdown(person.sourceBreakdown, sourceOrder),
  }))

  const profileToPerson = new Map<string, Person>()
  clusters.forEach((cluster, clusterIndex) => {
    const person = people[clusterIndex]
    cluster.forEach(({ profile }) => profileToPerson.set(profile.aliasKey, person))
  })

  const peopleById = new Map(people.map((person) => [person.id, person]))

  const resolvedRecords: ResolvedRecord[] = records.map((record) => {
    const actors = resolveActorsForRecord(record, profileToPerson)
    const personIds = uniqueValues(actors.map((actor) => actor.personId))
    return { id: record.id, actors, personIds }
  })

  return { people, peopleById, resolvedRecords }
}
