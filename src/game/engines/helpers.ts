import type { EngineVisit, WeightOf } from './types'

// Pairs visits: invited pairs first (both sides point at each other), the
// rest shuffled and paired in order; an odd visitor is left alone.
export function pairVisits(
  visits: EngineVisit[],
  rng: () => number,
): { pairs: Array<[EngineVisit, EngineVisit]>, alone: EngineVisit[] } {
  const byUser = new Map(visits.map(v => [v.userId, v]))
  const used = new Set<number>()
  const pairs: Array<[EngineVisit, EngineVisit]> = []
  for (const a of visits) {
    if (used.has(a.userId) || a.partnerId === undefined) continue
    const b = byUser.get(a.partnerId)
    if (!b || used.has(b.userId) || b.partnerId !== a.userId) continue
    used.add(a.userId)
    used.add(b.userId)
    pairs.push([a, b])
  }
  const rest = visits.filter(v => !used.has(v.userId))
  shuffle(rest, rng)
  for (let i = 0; i + 1 < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]])
  const alone = rest.length % 2 === 1 ? [rest[rest.length - 1]] : []
  return { pairs, alone }
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

// Integer split of `total` by trait weight; the remainder burns.
export function splitByWeight(total: bigint, visits: EngineVisit[], weightOf: WeightOf): Map<number, bigint> {
  const weights = visits.map(v => BigInt(weightOf(v.userId)))
  const sum = weights.reduce((a, b) => a + b, 0n)
  return new Map(visits.map((v, i) => [v.userId, sum > 0n ? (total * weights[i]) / sum : 0n]))
}
