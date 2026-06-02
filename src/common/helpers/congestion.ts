export type Risk = 'safe' | 'greedy'

// Greedy spans [0.4, 1.6] so its mean is exactly 1.0 — greedy redistributes a
// world's pool between players without changing the total minted, keeping the
// faucet bounded. Safe is a flat 1.0.
export const GREEDY_MIN_MULT = 0.4
export const GREEDY_MAX_MULT = 1.6
export const FLOOR_PAYOUT = 1

export interface Commitment {
  expeditionId: string
  // energy spent + any CUBE-boost weight, computed by the caller
  weight: number
  risk: Risk
  // uniform [0, 1] roll, injected for determinism/testability
  riskRoll: number
}

export interface Award {
  expeditionId: string
  award: number
}

export function riskMultiplier(risk: Risk, riskRoll: number): number {
  if (risk === 'safe') return 1
  const clamped = Math.min(1, Math.max(0, riskRoll))
  return GREEDY_MIN_MULT + clamped * (GREEDY_MAX_MULT - GREEDY_MIN_MULT)
}

// Divide a world's fixed CUBE pool among its commitments by effective weight
// (weight × risk multiplier). Total awarded is <= pool (floor rounding only
// reduces it); the per-share FLOOR_PAYOUT guarantees a participant never gets
// zero. An empty world mints nothing.
export function settleWorld(pool: number, commitments: Commitment[]): Award[] {
  if (commitments.length === 0) return []
  const effective = commitments.map((c) => ({
    expeditionId: c.expeditionId,
    eff: Math.max(0, c.weight) * riskMultiplier(c.risk, c.riskRoll),
  }))
  const totalEff = effective.reduce((s, e) => s + e.eff, 0)
  if (totalEff <= 0) {
    return commitments.map((c) => ({ expeditionId: c.expeditionId, award: FLOOR_PAYOUT }))
  }
  return effective.map((e) => ({
    expeditionId: e.expeditionId,
    award: Math.max(FLOOR_PAYOUT, Math.floor((pool * e.eff) / totalEff)),
  }))
}
