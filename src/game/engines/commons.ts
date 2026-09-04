import type { EngineOutcome, EngineResult, EngineVisit, WeightOf } from './types'
import { COMMONS_GROWTH_CAP, COMMONS_GROWTH_PERCENT, COMMONS_TAKE_CAP_MULTIPLIER } from '#root/game/places'

// Public-goods pool that persists across windows. Givers are paid the pool's
// growth (their return); takers draw a capped share; too many takers and the
// temple is plundered — pool resets, takers leave empty-handed.
export function resolveCommons(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  seed: bigint,
  pool: bigint,
  weightOf: WeightOf,
): EngineResult {
  if (visits.length === 0) return { outcomes: [], pool }
  const givers = visits.filter(v => v.move === 'give')
  const takers = visits.filter(v => v.move === 'take')

  let next = pool + BigInt(givers.length) * stake

  const growthPay = new Map<number, bigint>()
  if (givers.length > 0) {
    let growth = (next * BigInt(COMMONS_GROWTH_PERCENT)) / 100n
    if (growth > COMMONS_GROWTH_CAP) growth = COMMONS_GROWTH_CAP
    const weights = givers.map(g => BigInt(weightOf(g.userId)))
    const total = weights.reduce((a, b) => a + b, 0n)
    givers.forEach((g, i) => growthPay.set(g.userId, total > 0n ? (growth * weights[i]) / total : 0n))
  }

  const collapse = takers.length >= 3 && takers.length > givers.length
  let takePay = 0n
  if (collapse) {
    next = seed / 2n
  } else if (takers.length > 0) {
    const cap = stake * COMMONS_TAKE_CAP_MULTIPLIER
    const share = next / BigInt(takers.length)
    takePay = share < cap ? share : cap
    next -= takePay * BigInt(takers.length)
  }

  const tail = `${collapse ? 'plundered · ' : ''}pool ${next}`
  const outcomes: EngineOutcome[] = []
  for (const g of givers) {
    const paid = growthPay.get(g.userId) ?? 0n
    outcomes.push({ userId: g.userId, payout: paid, outcome: `${placeName} · you gave · +${paid} growth · ${tail}`, rep: { gave: 1 } })
  }
  for (const t of takers) {
    outcomes.push({
      userId: t.userId,
      payout: takePay,
      outcome: collapse ? `${placeName} · you took · ${tail}` : `${placeName} · you took · +${takePay} · ${tail}`,
      rep: { took: 1 },
    })
  }
  return { outcomes, pool: next }
}
