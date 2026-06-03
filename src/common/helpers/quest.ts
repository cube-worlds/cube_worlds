import type { EquipmentDrop } from './equipment'
import type { ResourceBag } from './production'
import { hashSeed, makeRng } from './combat'
import { rollEquipment } from './equipment'

// A hero is occupied for 8 hours on a quest (the §2.5 "8-hour expedition").
export const QUEST_DURATION_MS = 8 * 60 * 60 * 1000

// Stable per-quest key → seed. Fixed at start time, so a claim resolves the
// identical loot/drop no matter when (or how often) it is retried.
export function questSeed(userId: number, heroId: string, startMs: number): number {
  return hashSeed(`${userId}:${heroId}:${startMs}`)
}

export function isQuestReady(now: Date, endsAt: Date): boolean {
  return now.getTime() >= endsAt.getTime()
}

// Resource loot on completion — RICHER than the daily dungeon (an 8h opportunity
// cost gates supply). Resources only, NO CUBE (keeps the faucet discipline).
// Parameterized so the worst quest roll at a level still beats the best dungeon
// roll at the same level.
export function questLoot(seed: number, heroLevel: number): ResourceBag {
  const rng = makeRng((seed ^ 0x51ED2701) >>> 0)
  const base = 80 + 24 * Math.max(0, heroLevel - 1)
  const roll = (mult: number) => Math.max(0, Math.floor(base * mult * (0.9 + rng() * 0.2)))
  return { gold: roll(1), iron: roll(0.7), mana: roll(0.4), food: roll(0.6) }
}

// Flat-ish XP grant, larger than a dungeon win (DUNGEON_XP_WIN = 60).
export function questXp(heroLevel: number): number {
  return 120 + 8 * Math.max(1, heroLevel)
}

// Small chance of an Equipment drop on completion; deterministic from the seed.
export const EQUIP_DROP_CHANCE = 0.15

export function rollQuestDrop(seed: number): EquipmentDrop | null {
  const rng = makeRng((seed ^ 0x1B873593) >>> 0)
  if (rng() >= EQUIP_DROP_CHANCE) return null
  return rollEquipment((seed ^ 0x2545F491) >>> 0)
}
