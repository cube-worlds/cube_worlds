import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { VOLUNTEER_BONUS, VOLUNTEER_COST, VOLUNTEER_HERO } from '#root/game/places'
import { shuffle } from './helpers'

// Volunteer's dilemma: the reef rescue needs one diver. Nobody dives and every
// stake burns; otherwise waiters collect the bonus for free, divers pay a
// cost, and the strongest diver is the hero.
export function resolveVolunteer(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  weightOf: WeightOf,
  rng: () => number,
): EngineResult {
  const divers = visits.filter(v => v.move === 'dive')
  if (divers.length === 0) {
    return { outcomes: visits.map(v => ({ userId: v.userId, payout: 0n, outcome: `${placeName} · nobody dived · lost ${stake}` })) }
  }
  const hero = shuffle([...divers], rng).sort((a, b) => weightOf(b.userId) - weightOf(a.userId))[0]
  const outcomes: EngineOutcome[] = []
  for (const v of visits) {
    if (v.move !== 'dive') {
      outcomes.push({ userId: v.userId, payout: stake + VOLUNTEER_BONUS, outcome: `${placeName} · you waited · +${stake + VOLUNTEER_BONUS}` })
    } else if (v.userId === hero.userId) {
      outcomes.push({ userId: v.userId, payout: VOLUNTEER_HERO, outcome: `${placeName} · hero of the reef · +${VOLUNTEER_HERO}`, rep: { helped: 1 } })
    } else {
      const paid = stake + VOLUNTEER_BONUS - VOLUNTEER_COST
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · you dived · +${paid}`, rep: { helped: 1 } })
    }
  }
  return { outcomes }
}
