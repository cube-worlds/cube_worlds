export const ENERGY_MAX = 120
export const EXPEDITION_ENERGY_COST = 30
// +10 energy per hour => one energy point every 6 minutes.
export const ENERGY_REGEN_INTERVAL_MS = (60 * 60 * 1000) / 10
// CUBE sink: spend REFILL_CUBE_COST CUBE to gain REFILL_ENERGY_AMOUNT energy.
export const REFILL_CUBE_COST = 500
export const REFILL_ENERGY_AMOUNT = 30
// USDT sink: buying one Energy pack grants ENERGY_PACK_AMOUNT energy (capped at
// ENERGY_MAX) for ENERGY_PACK_PRICE_USDT. Tunable; see the economy tuning doc.
export const ENERGY_PACK_AMOUNT = 120
export const ENERGY_PACK_PRICE_USDT = 0.5

export interface RegenResult {
  current: number
  regenAt: Date
}

// Lazily compute regenerated energy. Stores back only the whole intervals that
// were consumed: a partial interval's remainder is preserved by advancing
// regenAt by the consumed whole intervals, not all the way to `now`. Once the
// balance is at (or over) the cap, regenAt jumps to `now` so no overflow is
// banked for later.
export function regenEnergy(
  current: number,
  regenAt: Date,
  now: Date = new Date(),
): RegenResult {
  if (current >= ENERGY_MAX) {
    return { current: ENERGY_MAX, regenAt: now }
  }
  const elapsed = Math.max(0, now.getTime() - regenAt.getTime())
  const earned = Math.floor(elapsed / ENERGY_REGEN_INTERVAL_MS)
  if (earned <= 0) {
    return { current, regenAt }
  }
  const next = current + earned
  if (next >= ENERGY_MAX) {
    return { current: ENERGY_MAX, regenAt: now }
  }
  const consumedMs = earned * ENERGY_REGEN_INTERVAL_MS
  return { current: next, regenAt: new Date(regenAt.getTime() + consumedMs) }
}
