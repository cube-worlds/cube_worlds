import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { shuffle, staked, treasury } from './helpers'

// All-pay auction: every bid is spent, the highest bid wins the prize
// (capped) and everything above the cap stays in the treasury. Ties: weight,
// then luck. Never pays out more than the room bid — this is the whale sink,
// and what it keeps is what funds the grants everywhere else.
export function resolveAllPay(
  placeName: string,
  visits: EngineVisit[],
  potCap: bigint,
  pool: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  if (visits.length < 2) {
    const outcomes = visits.map(v => ({ userId: v.userId, payout: v.stake, outcome: `${placeName} · nobody to outbid · refunded ${v.stake}`, refund: true }))
    return treasury(outcomes, visits, pool)
  }
  const ranked = shuffle([...visits], rng).sort((a, b) => {
    if (a.stake !== b.stake) return a.stake > b.stake ? -1 : 1
    return weightOf(b.userId) - weightOf(a.userId)
  })
  const total = staked(visits)
  const prize = total < potCap ? total : potCap
  const winner = ranked[0]
  const outcomes: EngineOutcome[] = [
    { userId: winner.userId, payout: prize, outcome: `${placeName} · face of the window · +${prize}` },
  ]
  for (const v of ranked.slice(1)) {
    outcomes.push({ userId: v.userId, partnerId: winner.userId, payout: 0n, outcome: `${placeName} · outbid · lost ${v.stake}` })
  }
  return treasury(outcomes, visits, pool)
}
