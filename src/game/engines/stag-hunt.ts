import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { HARE_BONUS, STAG_THRESHOLD } from '#root/game/places'
import { splitByWeight } from './helpers'

// Stag hunt: hares are a safe small win; stags need STAG_THRESHOLD hunters to
// bring the pot down, and go home empty-handed otherwise.
export function resolveStagHunt(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  pot: bigint,
  weightOf: WeightOf,
): EngineResult {
  const stags = visits.filter(v => v.move === 'stag')
  const hunted = stags.length >= STAG_THRESHOLD
  const shares = hunted ? splitByWeight(pot, stags, weightOf) : new Map<number, bigint>()
  const outcomes: EngineOutcome[] = []
  for (const v of visits) {
    if (v.move !== 'stag') {
      outcomes.push({ userId: v.userId, payout: stake + HARE_BONUS, outcome: `${placeName} · hare · +${stake + HARE_BONUS}` })
    } else if (hunted) {
      const paid = stake + (shares.get(v.userId) ?? 0n)
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · ${stags.length} hunters · stag down · +${paid}`, rep: { helped: 1 } })
    } else {
      outcomes.push({ userId: v.userId, payout: 0n, outcome: `${placeName} · ${stags.length} of ${STAG_THRESHOLD} hunters · too few · lost ${stake}` })
    }
  }
  return { outcomes }
}
