import type { EquipmentRarity } from '#root/common/helpers/equipment'
import { bossRewardTier } from '#root/common/helpers/boss'
import { hashSeed } from '#root/common/helpers/combat'
import { equipmentBonus, rollEquipment } from '#root/common/helpers/equipment'

export interface BossSettlementDependencies {
  // Closed weeks are those strictly before the current one (mirrors expedition
  // settlement's currentTickId gate). Injected so the pure module stays clock-free.
  currentWeekId: () => number
  distinctAttackWeeks: () => Promise<number[]>
  aggregateDamageByUser: (weekId: number) => Promise<Array<{ userId: number, total: number }>>
  claimBossReward: (weekId: number, userId: number, rarity: EquipmentRarity) => Promise<{ _id: unknown } | null>
  createEquipment: (input: { userId: number, slot: ReturnType<typeof rollEquipment>['slot'], rarity: EquipmentRarity, bonus: { hp: number, atk: number, def: number }, source: 'boss' }) => Promise<{ _id: unknown }>
  linkRewardEquipment: (rewardId: unknown, equipmentId: string) => Promise<void>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

export function buildBossSettlementRunner(deps: BossSettlementDependencies) {
  let running = false

  async function runOnce(): Promise<void> {
    if (running) return
    running = true
    try {
      const current = deps.currentWeekId()
      const weeks = (await deps.distinctAttackWeeks()).filter(w => w < current)
      for (const week of weeks) {
        const board = await deps.aggregateDamageByUser(week)
        const tally: Record<EquipmentRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
        for (let rank = 0; rank < board.length; rank++) {
          const tier = bossRewardTier(rank, board.length)
          if (!tier) continue
          const { userId } = board[rank]
          // Idempotency boundary: a re-run collides on (week, userId) → null → skip.
          const reward = await deps.claimBossReward(week, userId, tier)
          if (reward === null) continue
          try {
            // The TIER fixes the rarity; the seed only picks the slot/flavor.
            const slot = rollEquipment(hashSeed(`bossreward:${week}:${userId}`)).slot
            const item = await deps.createEquipment({ userId, slot, rarity: tier, bonus: equipmentBonus(slot, tier), source: 'boss' })
            await deps.linkRewardEquipment(reward._id, String(item._id))
            tally[tier]++
          } catch (err) {
            deps.logError(`Boss reward mint failed for ${userId} (week ${week}): ${(err as Error).message}`)
          }
        }
        const total = tally.legendary + tally.epic + tally.rare
        if (total > 0) {
          deps.logInfo(`Boss settlement: week ${week} awarded ${total} drops (${tally.legendary} legendary / ${tally.epic} epic / ${tally.rare} rare) over ${board.length} contributors`)
        }
      }
    } finally {
      running = false
    }
  }

  return { runOnce }
}
