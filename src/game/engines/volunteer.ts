import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { VOLUNTEER_BONUS, VOLUNTEER_COST } from '#root/game/places'
import { shuffle, treasury } from './helpers'

// Volunteer's dilemma: the reef rescue needs one diver. Nobody dives and every
// stake stays in the treasury; otherwise waiters collect the bonus for free,
// divers pay a cost, and the strongest diver is the hero on a double share.
//
// The bonus is a treasury grant spread over everyone present plus one extra
// share for the hero, so a room of free-riders splits a fixed grant thinner
// rather than each minting a fresh reward. A window where nobody dives is
// what refills the treasury the next window's waiters are paid from.
export function resolveVolunteer(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const divers = visits.filter(v => v.move === 'dive')
  if (divers.length === 0) {
    const outcomes = visits.map(v => ({ userId: v.userId, payout: 0n, outcome: `${placeName} · nobody dived · lost ${v.stake}` }))
    return treasury(outcomes, visits, pool)
  }
  // +1 share so the hero can be paid double without exceeding the grant.
  const perHead = grant / BigInt(visits.length + 1)
  const bonus = perHead < VOLUNTEER_BONUS ? perHead : VOLUNTEER_BONUS
  const hero = shuffle([...divers], rng).sort((a, b) => weightOf(b.userId) - weightOf(a.userId))[0]

  const outcomes: EngineOutcome[] = []
  for (const v of visits) {
    if (v.move !== 'dive') {
      outcomes.push({ userId: v.userId, payout: stake + bonus, outcome: `${placeName} · you waited · +${stake + bonus}` })
    } else if (v.userId === hero.userId) {
      const paid = stake + bonus * 2n
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · hero of the reef · +${paid}`, rep: { helped: 1 } })
    } else {
      const paid = stake + bonus > VOLUNTEER_COST ? stake + bonus - VOLUNTEER_COST : 0n
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · you dived · +${paid}`, rep: { helped: 1 } })
    }
  }
  return treasury(outcomes, visits, pool)
}
