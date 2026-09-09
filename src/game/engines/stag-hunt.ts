import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { HARE_BONUS, STAG_THRESHOLD } from '#root/game/places'
import { splitByWeight, treasury } from './helpers'

// Stag hunt: hares are a safe small win; stags need STAG_THRESHOLD hunters to
// bring the pot down, and go home empty-handed otherwise.
//
// Both rewards come out of the same treasury grant — half of it is reserved
// for the hares and thins as more of them show up, the rest is the stag pot.
// A failed hunt leaves the stags' stakes in the treasury, which is what pays
// for the next successful one.
export function resolveStagHunt(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
): EngineResult {
  const stags = visits.filter(v => v.move === 'stag')
  const hares = visits.filter(v => v.move !== 'stag')
  const perHare = hares.length > 0 ? grant / (2n * BigInt(hares.length)) : 0n
  const hareBonus = perHare < HARE_BONUS ? perHare : HARE_BONUS

  const hunted = stags.length >= STAG_THRESHOLD
  const stagPot = grant - hareBonus * BigInt(hares.length)
  const shares = hunted ? splitByWeight(stagPot, stags, weightOf) : new Map<number, bigint>()

  const outcomes: EngineOutcome[] = []
  for (const v of visits) {
    if (v.move !== 'stag') {
      outcomes.push({ userId: v.userId, payout: stake + hareBonus, outcome: `${placeName} · hare · +${stake + hareBonus}` })
    } else if (hunted) {
      const paid = stake + (shares.get(v.userId) ?? 0n)
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · ${stags.length} hunters · stag down · +${paid}`, rep: { helped: 1 } })
    } else {
      outcomes.push({ userId: v.userId, payout: 0n, outcome: `${placeName} · ${stags.length} of ${STAG_THRESHOLD} hunters · too few · lost ${stake}` })
    }
  }
  return treasury(outcomes, visits, pool)
}
