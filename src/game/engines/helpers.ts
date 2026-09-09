import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'

// Total staked into a window — the money the place is allowed to give back
// before it has to touch its treasury.
export function staked(visits: EngineVisit[]): bigint {
  return visits.reduce((sum, v) => sum + v.stake, 0n)
}

// Nothing in Bali is minted. A window pays out what its visitors staked plus
// at most `grant` from the place treasury, and whatever is not paid stays in
// the treasury. Engines size their prizes against `grant` up front so the
// numbers they write into the outcome text are the numbers actually paid —
// the proportional scale-down here is a backstop, and emission.test.ts fails
// if any engine ever leans on it.
//
// Refunds are stake returns, not prizes: they are paid in full before
// anything is scaled, so a visitor the engine could not play is never shaved.
export function treasury(outcomes: EngineOutcome[], visits: EngineVisit[], pool: bigint): EngineResult {
  const budget = staked(visits) + pool
  const refunded = outcomes.reduce((s, o) => s + (o.refund ? o.payout : 0n), 0n)
  const wanted = outcomes.reduce((s, o) => s + (o.refund ? 0n : o.payout), 0n)
  const left = budget - refunded
  if (wanted <= left) return { outcomes, pool: left - wanted }
  const scaled = outcomes.map(o => (o.refund ? o : { ...o, payout: (o.payout * left) / wanted }))
  const paid = scaled.reduce((s, o) => s + (o.refund ? 0n : o.payout), 0n)
  return { outcomes: scaled, pool: left - paid }
}

// What a place may add to this window's stakes: never more than the treasury
// holds, and never more than the room has staked times POT_TURNOUT_MULT — so
// two visitors to an empty place cannot walk off with a full pot.
export function grantFor(pot: bigint, visits: EngineVisit[], pool: bigint, mult: bigint): bigint {
  const byTurnout = staked(visits) * mult
  const capped = pot < byTurnout ? pot : byTurnout
  return capped < pool ? capped : pool
}

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
