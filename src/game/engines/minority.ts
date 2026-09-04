import type { EngineResult, EngineVisit, WeightOf } from './types'

// Minority game: a fixed pot split by trait weight among everyone who came.
// Fewer visitors → bigger share. The fee was debited at visit time; above
// pot / fee visitors the place is a net sink.
export function resolveMinority(
  placeName: string,
  visits: EngineVisit[],
  pot: bigint,
  weightOf: WeightOf,
): EngineResult {
  if (visits.length === 0) return { outcomes: [] }
  const weights = visits.map(v => BigInt(weightOf(v.userId)))
  const total = weights.reduce((a, b) => a + b, 0n)
  const outcomes = visits.map((v, i) => {
    const payout = total > 0n ? (pot * weights[i]) / total : 0n
    return {
      userId: v.userId,
      payout,
      outcome: `${placeName} · ${visits.length} visitor${visits.length === 1 ? '' : 's'} · your share ${payout}`,
    }
  })
  return { outcomes }
}
