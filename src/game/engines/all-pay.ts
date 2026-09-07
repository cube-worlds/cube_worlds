import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { shuffle } from './helpers'

// All-pay auction: every bid is spent, the highest bid wins the prize
// (capped) and everything else burns. Ties: weight, then luck. Nothing is
// minted — this is the whale sink.
export function resolveAllPay(
  placeName: string,
  visits: EngineVisit[],
  potCap: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  if (visits.length < 2) {
    return { outcomes: visits.map(v => ({ userId: v.userId, payout: v.stake, outcome: `${placeName} · nobody to outbid · refunded ${v.stake}`, refund: true })) }
  }
  const ranked = shuffle([...visits], rng).sort((a, b) => {
    if (a.stake !== b.stake) return a.stake > b.stake ? -1 : 1
    return weightOf(b.userId) - weightOf(a.userId)
  })
  const total = visits.reduce((sum, v) => sum + v.stake, 0n)
  const prize = total < potCap ? total : potCap
  const winner = ranked[0]
  const outcomes: EngineOutcome[] = [
    { userId: winner.userId, payout: prize, outcome: `${placeName} · face of the window · +${prize}` },
  ]
  for (const v of ranked.slice(1)) {
    outcomes.push({ userId: v.userId, partnerId: winner.userId, payout: 0n, outcome: `${placeName} · outbid · lost ${v.stake}` })
  }
  return { outcomes }
}
