import type { Stats } from './hero'
import type { ResourceBag } from './production'
import { hashSeed } from './combat'

// ECONOMY.md §2.4 prices. CUBE amounts are bigint because debitVotes takes bigint.
export const ARENA_ENTRY_CUBE = 10n
export const RAID_STAKE_CUBE = 50n
export const RAID_FOOD_UPKEEP = 25
export const RAID_LOOT_BPS = 1000 // floor(10%) of each defender bag
export const RAID_SHIELD_MS = 8 * 60 * 60 * 1000
export const RAIDS_PER_DAY = 3

export const ELO_K = 32
export const RATING_START = 1000
export const RATING_FLOOR = 100

export const ARENA_XP_WIN = 40
export const ARENA_XP_LOSS = 15

export const MAX_WALLS_BONUS_LEVEL = 10

// Standard ELO, clamped so a win always moves at least +1 and a loss at
// least -1 (a 0-delta fight would make the ladder feel dead at the extremes).
export function eloDelta(attackerRating: number, defenderRating: number, attackerWon: boolean): number {
  const expected = 1 / (1 + 10 ** ((defenderRating - attackerRating) / 400))
  const score = attackerWon ? 1 : 0
  const delta = Math.round(ELO_K * (score - expected))
  return attackerWon ? Math.max(1, delta) : Math.min(-1, delta)
}

// Seed fixed by the match id — assigned at insert, so a crash-retry resolves
// the IDENTICAL fight (the dungeonSeed discipline, keyed per match).
export function matchSeed(matchId: string): number {
  return hashSeed(`match:${matchId}`)
}

// Castle investment defends the castle: +5%/Walls level on hp and def (never
// atk — walls don't swing swords), floored, capped at MAX_WALLS_BONUS_LEVEL.
export function wallsBonus(stats: Stats, wallsLevel: number): Stats {
  const lvl = Math.max(0, Math.min(wallsLevel, MAX_WALLS_BONUS_LEVEL))
  const mult = 1 + 0.05 * lvl
  return { hp: Math.floor(stats.hp * mult), atk: stats.atk, def: Math.floor(stats.def * mult) }
}

// Pure mirror of the plunderResources pipeline math: floor(bag * bps/10000)
// per resource. 10% of what is actually there can never overdraw.
export function plunderAmounts(bag: ResourceBag, bps: number = RAID_LOOT_BPS): ResourceBag {
  const f = (v: number) => Math.max(0, Math.floor((v * bps) / 10_000))
  return { gold: f(bag.gold), iron: f(bag.iron), mana: f(bag.mana), food: f(bag.food) }
}

// Scalar used to pick the defender's strongest hero. Weights atk/def up since
// hp pools are numerically much larger than per-round stat points.
export function combatPower(s: Stats): number {
  return s.hp + 5 * s.atk + 5 * s.def
}

export function shieldActive(shieldUntil: Date | null | undefined, now: Date): boolean {
  return shieldUntil != null && shieldUntil.getTime() > now.getTime()
}
