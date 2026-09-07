import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { HAWK_DOVE_BONUS, HAWK_DOVE_FIGHT_PRIZE, HAWK_DOVE_YIELD } from '#root/game/places'
import { pairVisits } from './helpers'

// Hawk-dove in random pairs. A hawk takes most of the prize from a dove, two
// doves share it plus a world bonus, two hawks fight: a weight-weighted coin
// picks the winner and most of the prize burns.
export function resolveHawkDove(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const { pairs, alone } = pairVisits(visits, rng)
  const outcomes: EngineOutcome[] = []
  for (const [a, b] of pairs) {
    const aHawk = a.move === 'hawk'
    const bHawk = b.move === 'hawk'
    if (!aHawk && !bHawk) {
      const paid = stake + HAWK_DOVE_BONUS
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
    outcomes.push({ userId: v.userId, payout: stake, outcome: `${placeName} · nobody to fight · refunded ${stake}`, refund: true })
  }
  return { outcomes }
}
