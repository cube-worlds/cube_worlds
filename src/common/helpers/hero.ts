export const HERO_CLASSES = ['knight', 'mage', 'archer', 'rogue'] as const
export type HeroClass = (typeof HERO_CLASSES)[number]

export interface Stats {
  hp: number
  atk: number
  def: number
}

// Level-1 base stats per class.
export const BASE_STATS: Record<HeroClass, Stats> = {
  knight: { hp: 120, atk: 18, def: 12 },
  mage: { hp: 80, atk: 28, def: 6 },
  archer: { hp: 95, atk: 24, def: 8 },
  rogue: { hp: 100, atk: 22, def: 9 },
}

// Stat gain added per level above 1.
export const PER_LEVEL: Record<HeroClass, Stats> = {
  knight: { hp: 18, atk: 3, def: 2 },
  mage: { hp: 10, atk: 5, def: 1 },
  archer: { hp: 13, atk: 4, def: 1 },
  rogue: { hp: 14, atk: 4, def: 2 },
}

export const MAX_HERO_LEVEL = 30

export function statsForHero(heroClass: HeroClass, level: number): Stats {
  const lvl = Math.max(1, Math.min(level, MAX_HERO_LEVEL))
  const base = BASE_STATS[heroClass]
  const per = PER_LEVEL[heroClass]
  const steps = lvl - 1
  return {
    hp: base.hp + per.hp * steps,
    atk: base.atk + per.atk * steps,
    def: base.def + per.def * steps,
  }
}

// Cumulative XP required to REACH `level`. L1=0, L2=100, L3=300, L4=600 ...
export function xpToReach(level: number): number {
  if (level <= 1) return 0
  const l = Math.min(level, MAX_HERO_LEVEL)
  return 50 * (l - 1) * l
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (level < MAX_HERO_LEVEL && xp >= xpToReach(level + 1)) level++
  return level
}

export interface XpResult {
  xp: number
  level: number
  leveledUp: boolean
}

export function applyXp(currentXp: number, currentLevel: number, gained: number): XpResult {
  const xp = currentXp + Math.max(0, gained)
  const level = levelFromXp(xp)
  return { xp, level, leveledUp: level > currentLevel }
}

export interface RecruitCost {
  cube: bigint
  gold: number
}

// Escalates with how many heroes the user already owns (anti-inflation sink).
export function recruitCost(currentHeroCount: number): RecruitCost {
  const n = BigInt(Math.max(0, currentHeroCount) + 1)
  return { cube: 1000n * n, gold: 300 * (Math.max(0, currentHeroCount) + 1) }
}

// Tavern level sets how many heroes a player may hold.
export function tavernCapacity(tavernLevel: number): number {
  return 1 + Math.max(0, tavernLevel)
}
