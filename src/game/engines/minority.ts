import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { staked, treasury } from './helpers'

// The real minority game: two shrines, and the one with FEWER pilgrims is
// blessed. Its side splits the room's stakes plus a treasury grant by trait
// weight; the crowded shrine gets nothing. You win by predicting where the
// crowd will not go, which is the only place in Bali where reading the room —
// rather than your own traits — is the whole game.
//
// A legacy visit with no move counts as sunset: these places had no move until
// 2026-09-10, and an unresolved visit from before then must still settle.
export function resolveMinority(
  placeName: string,
  visits: EngineVisit[],
  grant: bigint,
  pool: bigint,
  weightOf: WeightOf,
): EngineResult {
  if (visits.length === 0) return { outcomes: [], pool }

  const sunrise = visits.filter(v => v.move === 'sunrise')
  const sunset = visits.filter(v => v.move !== 'sunrise')

  // No minority formed — one shrine empty, or a dead heat. Nobody read the
  // crowd better than anyone else, so nobody is charged for trying.
  if (sunrise.length === sunset.length || sunrise.length === 0 || sunset.length === 0) {
    const why = visits.length === 1 ? 'nobody else came' : 'no minority · the shrines drew even'
    const outcomes = visits.map(v => ({
      userId: v.userId,
      payout: v.stake,
      outcome: `${placeName} · ${why} · refunded ${v.stake}`,
      refund: true,
    }))
    return treasury(outcomes, visits, pool)
  }

  const blessed = sunrise.length < sunset.length ? sunrise : sunset
  const winners = new Set(blessed.map(v => v.userId))
  const prize = staked(visits) + grant
  const weights = blessed.map(v => BigInt(weightOf(v.userId)))
  const total = weights.reduce((a, b) => a + b, 0n)

  const outcomes: EngineOutcome[] = visits.map((v) => {
    const side = v.move === 'sunrise' ? 'sunrise' : 'sunset'
    if (!winners.has(v.userId)) {
      return { userId: v.userId, payout: 0n, outcome: `${placeName} · ${side} was crowded · lost ${v.stake}` }
    }
    const i = blessed.findIndex(b => b.userId === v.userId)
    const payout = total > 0n ? (prize * weights[i]) / total : 0n
    return {
      userId: v.userId,
      payout,
      outcome: `${placeName} · ${side} · ${blessed.length} of ${visits.length} · blessed · +${payout}`,
    }
  })
  return treasury(outcomes, visits, pool)
}
