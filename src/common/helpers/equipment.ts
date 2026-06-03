import type { Combatant } from './combat'
import type { Stats } from './hero'
import { makeRng } from './combat'

export const EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'accessory'] as const
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]

// Ordered weakest → strongest (the order is relied on by rollRarity's cumulative
// weights and by the boss reward tiers).
export const EQUIPMENT_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type EquipmentRarity = (typeof EQUIPMENT_RARITIES)[number]

// Each slot favors a stat: weapon → atk, body → hp/def (heavy armor), head → def,
// accessory → a balanced sprinkle. These are the COMMON-rarity baselines; higher
// rarities scale them by RARITY_MULT.
export const SLOT_PROFILE: Record<EquipmentSlot, Stats> = {
  weapon: { hp: 0, atk: 8, def: 1 },
  head: { hp: 12, atk: 0, def: 4 },
  body: { hp: 24, atk: 0, def: 6 },
  accessory: { hp: 10, atk: 3, def: 2 },
}

export const RARITY_MULT: Record<EquipmentRarity, number> = {
  common: 1,
  rare: 1.6,
  epic: 2.4,
  legendary: 3.5,
}

// The bonus an item of (slot, rarity) confers. Floored to whole stat points.
// Snapshotted onto the Equipment row at creation so a later table rebalance never
// silently restats owned gear.
export function equipmentBonus(slot: EquipmentSlot, rarity: EquipmentRarity): Stats {
  const base = SLOT_PROFILE[slot]
  const mult = RARITY_MULT[rarity]
  return {
    hp: Math.floor(base.hp * mult),
    atk: Math.floor(base.atk * mult),
    def: Math.floor(base.def * mult),
  }
}

// Sum the stored bonuses of every equipped item. Reads the snapshot, never recomputes.
export function aggregateEquipment(items: ReadonlyArray<Stats>): Stats {
  return items.reduce(
    (acc, b) => ({ hp: acc.hp + b.hp, atk: acc.atk + b.atk, def: acc.def + b.def }),
    { hp: 0, atk: 0, def: 0 },
  )
}

// Fold an equipment bonus into base hero stats → the Combatant the resolver eats.
// This is the single seam that lets gear change a fight without touching combat.ts.
export function withEquipment(base: Stats, bonus: Stats): Combatant {
  return { hp: base.hp + bonus.hp, atk: base.atk + bonus.atk, def: base.def + bonus.def }
}

// Drop distribution — weighted toward common (sum need not be 100; rollRarity
// normalizes). Aligned to EQUIPMENT_RARITIES order.
export const RARITY_WEIGHTS: Record<EquipmentRarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
}

export function rollRarity(rng: () => number): EquipmentRarity {
  const total = EQUIPMENT_RARITIES.reduce((a, r) => a + RARITY_WEIGHTS[r], 0)
  let roll = rng() * total
  for (const r of EQUIPMENT_RARITIES) {
    roll -= RARITY_WEIGHTS[r]
    if (roll < 0) return r
  }
  return EQUIPMENT_RARITIES[0]
}

export interface EquipmentDrop {
  slot: EquipmentSlot
  rarity: EquipmentRarity
  bonus: Stats
}

// Deterministic generation from a seed (reuses the combat PRNG). Same seed →
// identical drop, so a quest/boss reward can't be rerolled.
export function rollEquipment(seed: number): EquipmentDrop {
  const rng = makeRng(seed)
  const slot = EQUIPMENT_SLOTS[Math.floor(rng() * EQUIPMENT_SLOTS.length)]
  const rarity = rollRarity(rng)
  return { slot, rarity, bonus: equipmentBonus(slot, rarity) }
}
