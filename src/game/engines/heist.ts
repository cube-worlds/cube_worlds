import type { EngineOutcome, EngineResult, EngineVisit, TraitOf, WeightOf } from './types'
import { splitByWeight } from './helpers'

// One crew per window. Loot = all stakes + the minted pot. Loyal split it by
// weight; a betrayer minority takes double shares; a betrayer majority wakes
// the guards and everyone leaves with nothing. A betrayer whose Deceptiveness
// beats the best loyal Perception keeps the `stole` mark off the record.
export function resolveHeist(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  pot: bigint,
  weightOf: WeightOf,
  traitOf: TraitOf,
): EngineResult {
  if (visits.length < 2) {
    return { outcomes: visits.map(v => ({ userId: v.userId, payout: stake, outcome: `${placeName} · no crew · refunded ${stake}`, refund: true })) }
  }
  const loyal = visits.filter(v => v.move !== 'betray')
  const betrayers = visits.filter(v => v.move === 'betray')
  const outcomes: EngineOutcome[] = []

  if (betrayers.length >= loyal.length) {
    for (const v of loyal) outcomes.push({ userId: v.userId, payout: 0n, outcome: `${placeName} · guards woke up · 0` })
    for (const v of betrayers) outcomes.push({ userId: v.userId, payout: 0n, outcome: `${placeName} · guards woke up · you betrayed for nothing · 0`, rep: { stole: 1 } })
    return { outcomes }
  }

  const loot = visits.reduce((sum, v) => sum + v.stake, 0n) + pot
  if (betrayers.length === 0) {
    const shares = splitByWeight(loot, loyal, weightOf)
    for (const v of loyal) {
      const paid = shares.get(v.userId) ?? 0n
      outcomes.push({ userId: v.userId, payout: paid, outcome: `${placeName} · clean heist · crew of ${visits.length} · +${paid}`, rep: { helped: 1 } })
    }
    return { outcomes }
  }

  const unit = loot / BigInt(loyal.length + 2 * betrayers.length)
  const eye = Math.max(...loyal.map(l => traitOf(l.userId, 'Perception')))
  for (const v of loyal) {
    outcomes.push({ userId: v.userId, payout: unit, outcome: `${placeName} · heist · betrayed by ${betrayers.length} · +${unit}`, rep: { helped: 1 } })
  }
  for (const v of betrayers) {
    const hidden = traitOf(v.userId, 'Deceptiveness') > eye
    outcomes.push({ userId: v.userId, payout: unit * 2n, outcome: `${placeName} · you betrayed the crew · +${unit * 2n}`, ...(hidden ? {} : { rep: { stole: 1 } }) })
  }
  return { outcomes }
}
