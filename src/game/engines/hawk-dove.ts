import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { HAWK_DOVE_BONUS, HAWK_DOVE_FIGHT_PRIZE, HAWK_DOVE_YIELD } from '#root/game/places'
import { pairVisits, treasury } from './helpers'

// Hawk-dove in random pairs. A hawk takes most of the prize from a dove, two
// doves share it plus a bonus, two hawks fight: a weight-weighted coin picks
// the winner and most of the prize burns into the treasury.
//
// Backing down together is the only outcome that pays more than the pair
// staked, so its bonus comes from the treasury and thins out as more pairs
// claim it in the same window.
export function resolveHawkDove(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const { pairs, alone } = pairVisits(visits, rng)
  const doves = pairs.filter(([a, b]) => a.move !== 'hawk' && b.move !== 'hawk')
  const perHead = doves.length > 0 ? grant / (2n * BigInt(doves.length)) : 0n
  const bonus = perHead < HAWK_DOVE_BONUS ? perHead : HAWK_DOVE_BONUS

  const outcomes: EngineOutcome[] = []
  for (const [a, b] of pairs) {
    const aHawk = a.move === 'hawk'
    const bHawk = b.move === 'hawk'
    if (!aHawk && !bHawk) {
      const paid = stake + bonus
      for (const [v, p] of [[a, b], [b, a]] as const) {
        outcomes.push({ userId: v.userId, partnerId: p.userId, payout: paid, outcome: `${placeName} · both backed down · +${paid}` })
      }
    } else if (aHawk && bHawk) {
      const wa = weightOf(a.userId)
      const wb = weightOf(b.userId)
      const aWins = rng() < wa / (wa + wb)
      const [winner, loser] = aWins ? [a, b] : [b, a]
      outcomes.push({ userId: winner.userId, partnerId: loser.userId, payout: HAWK_DOVE_FIGHT_PRIZE, outcome: `${placeName} · you fought and won · +${HAWK_DOVE_FIGHT_PRIZE}`, rep: { took: 1 } })
      outcomes.push({ userId: loser.userId, partnerId: winner.userId, payout: 0n, outcome: `${placeName} · you fought and lost · 0`, rep: { took: 1 } })
    } else {
      const hawk = aHawk ? a : b
      const dove = aHawk ? b : a
      const taken = stake * 2n - HAWK_DOVE_YIELD
      outcomes.push({ userId: hawk.userId, partnerId: dove.userId, payout: taken, outcome: `${placeName} · they backed down · +${taken}`, rep: { took: 1 } })
      outcomes.push({ userId: dove.userId, partnerId: hawk.userId, payout: HAWK_DOVE_YIELD, outcome: `${placeName} · you backed down · ${HAWK_DOVE_YIELD}` })
    }
  }
  for (const v of alone) {
    outcomes.push({ userId: v.userId, payout: v.stake, outcome: `${placeName} · nobody to fight · refunded ${v.stake}`, refund: true })
  }
  return treasury(outcomes, visits, pool)
}
