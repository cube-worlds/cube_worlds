import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { ULTIMATUM_GREEDY_SHARE } from '#root/game/places'
import { pairVisits, treasury } from './helpers'

// Ultimatum in random pairs. The heavier visitor proposes. Each strategy
// covers both roles: fair offers and accepts anything, greedy offers a lion's
// share and accepts anything, strict offers fair but rejects greed — then the
// whole pot burns into the treasury.
//
// The bonus on a struck deal is a treasury grant shared across the deals
// actually struck this window, so a room that all plays fair splits one grant
// instead of each pair minting a bonus. Roles are settled first, then the
// bonus is sized, so the numbers in the outcome text are the ones paid.
export function resolveUltimatum(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  bonusCap: bigint,
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const { pairs, alone } = pairVisits(visits, rng)
  const settled = pairs.map(([a, b]) => {
    const wa = weightOf(a.userId)
    const wb = weightOf(b.userId)
    const aProposes = wa > wb || (wa === wb && rng() < 0.5)
    const [proposer, responder] = aProposes ? [a, b] : [b, a]
    const rejected = proposer.move === 'greedy' && responder.move === 'strict'
    return { proposer, responder, rejected }
  })

  const deals = settled.filter(p => !p.rejected).length
  const perDeal = deals > 0 ? grant / BigInt(deals) : 0n
  const bonus = perDeal < bonusCap ? perDeal : bonusCap
  const total = stake * 2n + bonus
  const fair = total / 2n
  const greedy = ULTIMATUM_GREEDY_SHARE < total ? ULTIMATUM_GREEDY_SHARE : total

  const outcomes: EngineOutcome[] = []
  for (const { proposer, responder, rejected } of settled) {
    if (rejected) {
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: 0n, outcome: `${placeName} · your greedy offer was rejected · burned` })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: 0n, outcome: `${placeName} · you rejected a greedy offer · burned` })
    } else if (proposer.move !== 'greedy') {
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: fair, outcome: `${placeName} · you offered a fair split · +${fair}`, rep: { gave: 1 } })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: fair, outcome: `${placeName} · fair offer · +${fair}` })
    } else {
      const crumbs = total - greedy
      outcomes.push({ userId: proposer.userId, partnerId: responder.userId, payout: greedy, outcome: `${placeName} · your greedy offer was accepted · +${greedy}`, rep: { took: 1 } })
      outcomes.push({ userId: responder.userId, partnerId: proposer.userId, payout: crumbs, outcome: `${placeName} · you accepted a greedy offer · ${crumbs}` })
    }
  }
  for (const v of alone) {
    outcomes.push({ userId: v.userId, payout: v.stake, outcome: `${placeName} · nobody came · refunded ${v.stake}`, refund: true })
  }
  return treasury(outcomes, visits, pool)
}
