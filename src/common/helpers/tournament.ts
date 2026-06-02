// A tournament week is a fixed 7-day window aligned to Monday 00:00 UTC,
// derivable from the clock alone (no week table), exactly like tick.ts. The
// 1970-01-01 epoch was a Thursday, so shift forward 3 days so floor() lands
// week boundaries on Monday.
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WEEK_ALIGN_MS = 3 * 24 * 60 * 60 * 1000

// CUBE sink #3: the weekly tournament entry fee.
export const TOURNAMENT_ENTRY_CUBE = 2_000

// Payout weights for the top entrants, in basis points of the prize pool. The
// array length is the number of paid places; weights sum to 10_000 (100%).
export const PAYOUT_WEIGHTS_BPS = [
  3000, 2000, 1500, 1000, 700, 600, 500, 300, 250, 150,
]

export function currentWeekId(now: Date = new Date()): number {
  return Math.floor((now.getTime() + WEEK_ALIGN_MS) / WEEK_MS)
}

export function weekStart(weekId: number): Date {
  return new Date(weekId * WEEK_MS - WEEK_ALIGN_MS)
}

export function weekEnd(weekId: number): Date {
  return new Date((weekId + 1) * WEEK_MS - WEEK_ALIGN_MS)
}

// A week is settleable once wall-clock time has reached the start of the next.
export function isWeekClosed(weekId: number, now: Date = new Date()): boolean {
  return now.getTime() >= weekEnd(weekId).getTime()
}

// Split a prize pool (bigint micro-USDT) across the top ranks by
// PAYOUT_WEIGHTS_BPS. Pure + integer-safe: each place gets
// floor(pool * bps / totalBps); any rounding remainder is added to rank 1 so the
// payouts sum EXACTLY to the pool (never over). The number of paid places is
// min(entrantCount, weights.length), and the used weights are renormalized so a
// short field still distributes 100% of the pool.
export function splitPrizePool(poolMicro: bigint, entrantCount: number): bigint[] {
  if (poolMicro <= 0n || entrantCount <= 0)
    return []
  const places = Math.min(entrantCount, PAYOUT_WEIGHTS_BPS.length)
  const used = PAYOUT_WEIGHTS_BPS.slice(0, places)
  const totalBps = used.reduce((a, b) => a + b, 0)
  const payouts = used.map(bps => (poolMicro * BigInt(bps)) / BigInt(totalBps))
  const distributed = payouts.reduce((a, b) => a + b, 0n)
  payouts[0] += poolMicro - distributed // remainder to rank 1
  return payouts
}
