import type { HeroClass } from './hero'
import { statsForHero } from './hero'

// mulberry32 — a small, fast, fully deterministic PRNG. Pure: a given seed
// always produces the same stream. Used so combat is reproducible for replay
// and verification (the Phase B exit criterion).
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a 32-bit string hash → uint32, for deriving a combat seed from a
// stable per-fight key (userId:heroId:day). Pure.
export function hashSeed(input: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Combatant {
  hp: number
  atk: number
  def: number
}

export interface CombatRound {
  attacker: 'hero' | 'enemy'
  damage: number
  heroHp: number
  enemyHp: number
}

export interface CombatResult {
  win: boolean
  rounds: CombatRound[]
  heroHpRemaining: number
}

// Bounds the fight so it always terminates (a stalemate ends in a loss).
export const MAX_ROUNDS = 100
const VARIANCE_MIN = 0.85
const VARIANCE_SPAN = 0.30 // damage multiplier ∈ [0.85, 1.15)

function rollDamage(rng: () => number, atk: number, def: number): number {
  const base = Math.max(1, atk - def)
  const variance = VARIANCE_MIN + rng() * VARIANCE_SPAN
  return Math.max(1, Math.floor(base * variance))
}

// Hero strikes first each round. Deterministic given (seed, hero, enemy).
// Each exchange (hero strike + optional enemy counter) contributes at most 2
// entries to `rounds`. MAX_ROUNDS caps the total entries — not the exchange
// count — so a stalemate always ends with rounds.length <= MAX_ROUNDS.
export function resolveCombat(seed: number, hero: Combatant, enemy: Combatant): CombatResult {
  const rng = makeRng(seed)
  let heroHp = hero.hp
  let enemyHp = enemy.hp
  const rounds: CombatRound[] = []
  while (heroHp > 0 && enemyHp > 0 && rounds.length < MAX_ROUNDS) {
    const hDmg = rollDamage(rng, hero.atk, enemy.def)
    enemyHp = Math.max(0, enemyHp - hDmg)
    rounds.push({ attacker: 'hero', damage: hDmg, heroHp, enemyHp })
    if (enemyHp <= 0 || rounds.length >= MAX_ROUNDS) break
    const eDmg = rollDamage(rng, enemy.atk, hero.def)
    heroHp = Math.max(0, heroHp - eDmg)
    rounds.push({ attacker: 'enemy', damage: eDmg, heroHp, enemyHp })
  }
  return { win: enemyHp <= 0 && heroHp > 0, rounds, heroHpRemaining: heroHp }
}

export function resolveHeroCombat(
  seed: number,
  heroClass: HeroClass,
  level: number,
  enemy: Combatant,
): CombatResult {
  return resolveCombat(seed, statsForHero(heroClass, level), enemy)
}
