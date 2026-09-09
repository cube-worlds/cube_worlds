import type { EngineResult, EngineVisit, WeightOf } from './types'
import { staked, treasury } from './helpers'

// Minority game: everyone who came splits the room's stakes plus a treasury
// grant, by trait weight. You beat your stake by having traits the crowd
// lacks, so a thin crowd is worth showing up for — but the grant is capped by
// turnout, so an empty place can no longer hand two visitors a whole pot.
export function resolveMinority(
  placeName: string,
  visits: EngineVisit[],
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
): EngineResult {
  if (visits.length === 0) return { outcomes: [], pool }
  const prize = staked(visits) + grant
  const weights = visits.map(v => BigInt(weightOf(v.userId)))
  const total = weights.reduce((a, b) => a + b, 0n)
  const outcomes = visits.map((v, i) => {
    const payout = total > 0n ? (prize * weights[i]) / total : 0n
    return {
      userId: v.userId,
      payout,
      outcome: `${placeName} · ${visits.length} visitor${visits.length === 1 ? '' : 's'} · your share ${payout}`,
    }
  })
  return treasury(outcomes, visits, pool)
}
