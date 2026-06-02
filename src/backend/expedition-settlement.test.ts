/* eslint-disable test/no-import-node-test */
import type { SettlementDependencies } from '#root/backend/expedition-settlement'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSettlementRunner } from '#root/backend/expedition-settlement'
import { BalanceChangeType } from '#root/common/models/Balance'

test('settles a closed world: splits pool and credits CUBE', async () => {
  const credits: Array<{ userId: number, add: bigint, reason: BalanceChangeType }> = []
  const settledExpeditions: Array<{ id: unknown, award: number }> = []
  const settledWorlds: Array<{ tickId: number, worldId: string }> = []

  const expeditions = [
    { _id: 'e1', userId: 1, worldId: 'frostvault', weight: 30, risk: 'safe', riskRoll: 0, settled: false, credited: false, cubeAwarded: 0 },
    { _id: 'e2', userId: 2, worldId: 'frostvault', weight: 30, risk: 'safe', riskRoll: 0, settled: false, credited: false, cubeAwarded: 0 },
  ]

  const deps: SettlementDependencies = {
    currentTickId: () => 101,
    findUnsettledWorlds: async () => [{ tickId: 100, worldId: 'frostvault', cubePool: 5000 } as any],
    findUnsettledForWorld: async () => expeditions as any,
    rollRisk: () => 0,
    settleExpedition: async (id, award) => {
      const e = expeditions.find((x) => x._id === id)!
      e.settled = true
      e.cubeAwarded = award
      settledExpeditions.push({ id, award })
      return true
    },
    markWorldSettled: async (tickId, worldId) => { settledWorlds.push({ tickId, worldId }) },
    findSettledUncredited: async () => expeditions.filter((e) => e.settled && !e.credited) as any,
    claimCredit: async (id) => {
      const e = expeditions.find((x) => x._id === id)!
      if (e.credited) return false
      e.credited = true
      return true
    },
    addPoints: async (userId, add, reason) => { credits.push({ userId, add, reason }); return add },
    logInfo: () => {},
    logError: () => {},
  }

  const runner = buildSettlementRunner(deps)
  await runner.runOnce()

  assert.deepEqual(settledExpeditions, [
    { id: 'e1', award: 2500 },
    { id: 'e2', award: 2500 },
  ])
  assert.deepEqual(settledWorlds, [{ tickId: 100, worldId: 'frostvault' }])
  assert.equal(credits.length, 2)
  assert.deepEqual(credits[0], { userId: 1, add: 2500n, reason: BalanceChangeType.Expedition })
})

test('is idempotent: a second run credits nobody twice', async () => {
  const credits: bigint[] = []
  const expeditions = [
    { _id: 'e1', userId: 1, worldId: 'frostvault', weight: 30, risk: 'safe', riskRoll: 0, settled: true, credited: true, cubeAwarded: 2500 },
  ]
  const deps: SettlementDependencies = {
    currentTickId: () => 101,
    findUnsettledWorlds: async () => [],
    findUnsettledForWorld: async () => [],
    rollRisk: () => 0,
    settleExpedition: async () => true,
    markWorldSettled: async () => {},
    findSettledUncredited: async () => expeditions.filter((e) => !e.credited) as any,
    claimCredit: async () => false,
    addPoints: async (_id, add) => { credits.push(add); return add },
    logInfo: () => {},
    logError: () => {},
  }
  const runner = buildSettlementRunner(deps)
  await runner.runOnce()
  assert.equal(credits.length, 0)
})

test('a CAS loss on credit skips the addPoints call', async () => {
  const credits: bigint[] = []
  const expeditions = [
    { _id: 'e1', userId: 1, worldId: 'frostvault', weight: 30, risk: 'safe', riskRoll: 0, settled: true, credited: false, cubeAwarded: 2500 },
  ]
  const deps: SettlementDependencies = {
    currentTickId: () => 101,
    findUnsettledWorlds: async () => [],
    findUnsettledForWorld: async () => [],
    rollRisk: () => 0,
    settleExpedition: async () => true,
    markWorldSettled: async () => {},
    findSettledUncredited: async () => expeditions as any,
    claimCredit: async () => false, // lost the race to another runner
    addPoints: async (_id, add) => { credits.push(add); return add },
    logInfo: () => {},
    logError: () => {},
  }
  const runner = buildSettlementRunner(deps)
  await runner.runOnce()
  assert.equal(credits.length, 0)
})
