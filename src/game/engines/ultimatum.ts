import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { ULTIMATUM_GREEDY_SHARE } from '#root/game/places'
import { pairVisits } from './helpers'

// Ultimatum in random pairs. The heavier visitor proposes. Each strategy
// covers both roles: fair offers and accepts anything, greedy offers a lion's
// share and accepts anything, strict offers fair but rejects greed — then the
// whole pot burns.
export function resolveUltimatum(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  bonus: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const { pairs, alone } = pairVisits(visits, rng)
  const total = stake * 2n + bonus
  const fair = total / 2n
  const outcomes: EngineOutcome[] = []
  for (const [a, b] of pairs) {
    const wa = weightOf(a.userId)
    const wb = weightOf(b.userId)
    const aProposes = wa > wb || (wa === wb && rng() < 0.5)
    const [proposer, responder] = aProposes ? [a, b] : [b, a]
    if (proposer.move !== 'greedy') {
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: fair, outcome: `${placeName} · you offered a fair split · +${fair}`, rep: { gave: 1 } })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: fair, outcome: `${placeName} · fair offer · +${fair}` })
    } else if (responder.move === 'strict') {
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: 0n, outcome: `${placeName} · your greedy offer was rejected · burned` })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: 0n, outcome: `${placeName} · you rejected a greedy offer · burned` })
    } else {
      const crumbs = total - ULTIMATUM_GREEDY_SHARE
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: ULTIMATUM_GREEDY_SHARE, outcome: `${placeName} · your greedy offer was accepted · +${ULTIMATUM_GREEDY_SHARE}`, rep: { took: 1 } })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: crumbs, outcome: `${placeName} · you accepted a greedy offer · ${crumbs}` })
    }
  }
  for (const v of alone) {
    outcomes.push({ userId: v.userId, payout: stake, outcome: `${placeName} · nobody came · refunded ${stake}`, refund: true })
  }
  return { outcomes }
}
