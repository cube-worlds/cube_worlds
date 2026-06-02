// An 8-hour production tick, separate from the 1-hour expedition tick.ts.
// Production accrues lazily and is computed at claim time (like regenEnergy),
// so no per-castle timer or tick table is needed.
export const PRODUCTION_TICK_MS = 8 * 60 * 60 * 1000

// Unclaimed production stops accruing after 3 ticks (24h) — the "open daily or
// lose it" retention hook from docs/ANCIENT_WORLDS_PLAN.md §2.2.
export const MAX_UNCLAIMED_TICKS = 3

// Founder CNFT holders earn +20% production (docs §2.4 / §3.2).
export const FOUNDER_MULTIPLIER = 1.2

export interface ResourceBag {
  gold: number
  iron: number
  mana: number
  food: number
}

// Base output per tick at Mine level 0, non-founder.
export const BASE_PRODUCTION: ResourceBag = {
  gold: 50,
  iron: 30,
  mana: 10,
  food: 40,
}

export interface ProductionInput {
  lastProductionAt: Date
  mineLevel: number
  isFounder: boolean
}

export interface ProductionResult {
  ticks: number
  gained: ResourceBag
  nextProductionAt: Date
}

export function computeProduction(
  input: ProductionInput,
  now: Date = new Date(),
): ProductionResult {
  const elapsed = Math.max(0, now.getTime() - input.lastProductionAt.getTime())
  const whole = Math.floor(elapsed / PRODUCTION_TICK_MS)
  const ticks = Math.min(whole, MAX_UNCLAIMED_TICKS)
  if (ticks <= 0) {
    return {
      ticks: 0,
      gained: { gold: 0, iron: 0, mana: 0, food: 0 },
      nextProductionAt: input.lastProductionAt,
    }
  }
  const mineMult = 1 + 0.25 * Math.max(0, input.mineLevel)
  const founderMult = input.isFounder ? FOUNDER_MULTIPLIER : 1
  const perTick = (base: number) => Math.floor(base * mineMult * founderMult)
  const gained: ResourceBag = {
    gold: perTick(BASE_PRODUCTION.gold) * ticks,
    iron: perTick(BASE_PRODUCTION.iron) * ticks,
    mana: perTick(BASE_PRODUCTION.mana) * ticks,
    food: perTick(BASE_PRODUCTION.food) * ticks,
  }
  // When capped, jump the clock to now so banked overflow isn't paid later
  // (mirrors regenEnergy's cap behavior). Otherwise advance by consumed ticks
  // so a partial tick's remainder is preserved.
  const nextProductionAt
    = whole > MAX_UNCLAIMED_TICKS
      ? now
      : new Date(input.lastProductionAt.getTime() + ticks * PRODUCTION_TICK_MS)
  return { ticks, gained, nextProductionAt }
}
