import type { Combatant } from './combat'
import type { ResourceBag } from './production'
import { hashSeed, makeRng } from './combat'

export const DAY_MS = 24 * 60 * 60 * 1000

export function dayBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / DAY_MS)
}

// Stable per-fight key → seed. Fixed for a given user+hero+day, so a retry
// resolves the identical fight (no rerolling for a better outcome).
export function dungeonSeed(userId: number, heroId: string, day: number): number {
  return hashSeed(`${userId}:${heroId}:${day}`)
}

// Enemy scales to the hero's level so the fight stays a skill/variance check
// rather than a pushover or a wall.
export function dungeonEnemy(heroLevel: number): Combatant {
  const l = Math.max(1, heroLevel)
  return { hp: 90 + 16 * (l - 1), atk: 20 + 3 * (l - 1), def: 8 + (l - 1) }
}

export const DUNGEON_XP_WIN = 60
export const DUNGEON_XP_LOSS = 20

// Resource loot on a win, deterministic from the fight seed and scaled by level.
// Resources only — NO CUBE (keeps the CUBE faucet discipline; CUBE loot is a
// deferred, separately-gated decision).
export function dungeonLoot(seed: number, heroLevel: number): ResourceBag {
  const rng = makeRng((seed ^ 0x9E3779B9) >>> 0)
  const base = 20 + 10 * Math.max(0, heroLevel - 1)
  const roll = (mult: number) => Math.max(0, Math.floor(base * mult * (0.8 + rng() * 0.4)))
  return { gold: roll(1), iron: roll(0.7), mana: roll(0.3), food: roll(0.5) }
}
