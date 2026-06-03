/* eslint-disable test/no-import-node-test */
import type { BossSettlementDependencies } from '#root/backend/boss-settlement'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBossSettlementRunner } from '#root/backend/boss-settlement'

// A 10-contributor board: ranks 0 (legendary, p<0.05 → only rank 0),
// 1 (epic, p=0.1<0.2), ... ranks 2-4 epic (p<0.2 → ranks 0..1; actually 0.2*10=2 → ranks<2),
// We compute tiers via the real bossRewardTier so just assert counts add up.
function board(n: number) {
  return Array.from({ length: n }, (_, i) => ({ userId: 100 + i, total: 1000 - i }))
}

function makeDeps(overrides: Partial<BossSettlementDependencies> = {}) {
  const rewarded = new Set<string>()
  const created: any[] = []
  const linked: any[] = []
  const deps: BossSettlementDependencies = {
    currentWeekId: () => 1005,
    distinctAttackWeeks: async () => [1000, 1005], // 1005 is the OPEN (current) week
    aggregateDamageByUser: async () => board(10),
    claimBossReward: async (week, userId, rarity) => {
      const key = `${week}:${userId}`
      if (rewarded.has(key)) return null
      rewarded.add(key)
      return { _id: `r-${key}-${rarity}` }
    },
    createEquipment: async (input) => { created.push(input); return { _id: `e${created.length}` } },
    linkRewardEquipment: async (rewardId, equipmentId) => { linked.push({ rewardId, equipmentId }) },
    logInfo: () => {},
    logError: () => {},
    ...overrides,
  }
  return { deps, rewarded, created, linked }
}

test('settles only closed weeks and awards tiered drops', async () => {
  const { deps, created } = makeDeps()
  await buildBossSettlementRunner(deps).runOnce()
  // only week 1000 (closed) is settled; 1005 (current) is skipped
  assert.ok(created.every(c => c.source === 'boss'))
  // rank 0 → legendary; some epics; some rares; bottom ranks → no drop
  const rarities = created.map(c => c.rarity)
  assert.ok(rarities.includes('legendary'))
  assert.ok(rarities.includes('epic') || rarities.includes('rare'))
  // a 10-board: ranks with p>=0.5 (ranks 5..9) get nothing → at most 5 drops
  assert.ok(created.length <= 5, `expected <=5 drops, got ${created.length}`)
})

test('re-running awards nothing new (idempotent per week+user)', async () => {
  const { deps, created } = makeDeps()
  const runner = buildBossSettlementRunner(deps)
  await runner.runOnce()
  const firstCount = created.length
  await runner.runOnce()
  assert.equal(created.length, firstCount, 'second run must not create more equipment')
})

test('the current (open) week is never settled', async () => {
  const { deps, created } = makeDeps({
    currentWeekId: () => 1000,
    distinctAttackWeeks: async () => [1000], // equals current → not closed
  })
  await buildBossSettlementRunner(deps).runOnce()
  assert.equal(created.length, 0)
})

test('below-cutoff ranks get no drop', async () => {
  const { deps, created } = makeDeps({ aggregateDamageByUser: async () => board(2) })
  await buildBossSettlementRunner(deps).runOnce()
  // board of 2: rank 0 p=0 → legendary; rank 1 p=0.5 → null
  assert.equal(created.length, 1)
  assert.equal(created[0].rarity, 'legendary')
})
