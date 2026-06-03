import type { Combatant } from './combat'
import type { EquipmentRarity } from './equipment'
import { hashSeed, makeRng, resolveCombat } from './combat'

const BOSS_NAMES = [
  'Stone Colossus',
  'Ancient Wyrm',
  'Sunken Leviathan',
  'Obsidian Titan',
  'Hollow King',
  'Ashen Behemoth',
]

export interface Boss extends Combatant {
  name: string
}

// One boss per Monday-aligned week, seeded from the weekId so every player faces
// the same boss that week. Huge HP — it is a shared damage sponge, not a kill.
export function bossForWeek(weekId: number): Boss {
  const rng = makeRng(hashSeed(`boss:${weekId}`))
  const hp = 4000 + Math.floor(rng() * 4000)
  const atk = 30 + Math.floor(rng() * 30)
  const def = 10 + Math.floor(rng() * 15)
  const name = BOSS_NAMES[((weekId % BOSS_NAMES.length) + BOSS_NAMES.length) % BOSS_NAMES.length]
  return { name, hp, atk, def }
}

// A hero's contribution to the shared board: the total damage it lands on the
// boss in one deterministic, MAX_ROUNDS-bounded fight. The boss rarely dies; a
// stronger hero (more atk / survives longer) deals strictly more.
export function bossDamage(seed: number, heroStats: Combatant, boss: Combatant): number {
  const result = resolveCombat(seed, heroStats, boss)
  return result.rounds
    .filter(r => r.attacker === 'hero')
    .reduce((sum, r) => sum + r.damage, 0)
}

export const BOSS_ATTACK_XP = 40

// Rank → reward tier by percentile of the contributor board. Top 5% legendary,
// next 15% epic, next 30% rare, the rest get no drop. rankIndex is 0-based (0 = top).
export function bossRewardTier(rankIndex: number, totalContributors: number): EquipmentRarity | null {
  if (totalContributors <= 0 || rankIndex < 0 || rankIndex >= totalContributors) return null
  const p = rankIndex / totalContributors
  if (p < 0.05) return 'legendary'
  if (p < 0.20) return 'epic'
  if (p < 0.50) return 'rare'
  return null
}
