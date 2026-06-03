/* eslint-disable test/no-import-node-test */
import type { EquipmentMintDependencies } from '#root/backend/equipment-mint'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEquipmentMintRunner, planEquipmentMints } from '#root/backend/equipment-mint'

test('planEquipmentMints caps the batch', () => {
  const u = [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }, { _id: 'c', userId: 3 }]
  assert.deepEqual(planEquipmentMints(u, 2), [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }])
})

function makeDeps(overrides: Partial<EquipmentMintDependencies> = {}) {
  const calls = { minted: [] as number[], flipped: [] as any[] }
  const deps: EquipmentMintDependencies = {
    batchSize: 10,
    findUnmintedEquipment: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintEquipmentNft: async (_id, userId) => { calls.minted.push(userId); return `EQitem${userId}` },
    markEquipmentMinted: async (equipmentId, address) => { calls.flipped.push({ equipmentId, address }) },
    logInfo: () => {},
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

test('runner mints each unminted item then flips the flag', async () => {
  const { deps, calls } = makeDeps()
  await buildEquipmentMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [1, 2])
  assert.equal(calls.flipped.length, 2)
})

test('a mint failure does not flip the flag and does not abort the batch', async () => {
  const { deps, calls } = makeDeps({ mintEquipmentNft: async (_id, userId) => { if (userId === 1) throw new Error('chain'); calls.minted.push(userId); return `EQ${userId}` } })
  await buildEquipmentMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [2])
  assert.equal(calls.flipped.length, 1)
})

test('runOnce is re-entrancy-guarded: an overlapping call is a no-op', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => { release = r })
  const calls = { minted: [] as number[] }
  const deps: EquipmentMintDependencies = {
    batchSize: 10,
    findUnmintedEquipment: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintEquipmentNft: async (_id, userId) => { await gate; calls.minted.push(userId); return `EQ${userId}` },
    markEquipmentMinted: async () => {},
    logInfo: () => {},
    logError: () => {},
  }
  const runner = buildEquipmentMintRunner(deps)
  const first = runner.runOnce()
  const second = runner.runOnce()
  await second
  release()
  await first
  assert.deepEqual(calls.minted.sort((a, b) => a - b), [1, 2])
})
