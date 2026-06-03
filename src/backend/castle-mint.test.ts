/* eslint-disable test/no-import-node-test */
import type { CastleMintDependencies } from '#root/backend/castle-mint'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCastleMintRunner, planCastleMints } from '#root/backend/castle-mint'

test('planCastleMints caps the batch', () => {
  const unminted = [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }, { _id: 'c', userId: 3 }]
  assert.deepEqual(planCastleMints(unminted, 2), [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }])
  assert.deepEqual(planCastleMints([], 2), [])
})

function makeDeps(overrides: Partial<CastleMintDependencies> = {}) {
  const calls = { minted: [] as number[], flipped: [] as any[] }
  const deps: CastleMintDependencies = {
    batchSize: 10,
    findUnmintedCastles: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintCastleNft: async userId => { calls.minted.push(userId); return `EQaddr${userId}` },
    markCastleMinted: async (castleId, address) => { calls.flipped.push({ castleId, address }) },
    logInfo: () => {},
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

test('runner mints each unminted castle then flips the DB flag', async () => {
  const { deps, calls } = makeDeps()
  await buildCastleMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [1, 2])
  assert.deepEqual(calls.flipped, [
    { castleId: 'a', address: 'EQaddr1' },
    { castleId: 'b', address: 'EQaddr2' },
  ])
})

test('a mint failure does not flip the flag and does not abort the batch', async () => {
  const { deps, calls } = makeDeps({
    mintCastleNft: async (userId) => {
      if (userId === 1) throw new Error('chain timeout')
      calls.minted.push(userId)
      return `EQaddr${userId}`
    },
  })
  await buildCastleMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [2])
  assert.deepEqual(calls.flipped, [{ castleId: 'b', address: 'EQaddr2' }])
})

test('runOnce is re-entrancy-guarded: an overlapping call while minting is a no-op', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => { release = r })
  const calls = { minted: [] as number[], flipped: [] as unknown[] }
  const deps: CastleMintDependencies = {
    batchSize: 10,
    findUnmintedCastles: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintCastleNft: async (userId) => { await gate; calls.minted.push(userId); return `EQ${userId}` },
    markCastleMinted: async (castleId) => { calls.flipped.push(castleId) },
    logInfo: () => {},
    logError: () => {},
  }
  const runner = buildCastleMintRunner(deps)
  const first = runner.runOnce()      // enters, blocks on the gate inside mintCastleNft
  const second = runner.runOnce()     // running === true → must bail immediately
  await second                        // resolves without minting anything
  release()                           // let the first run finish
  await first
  // Only the first run minted; the overlapping second was a no-op (no double-mint)
  assert.deepEqual(calls.minted.sort((a, b) => a - b), [1, 2])
})
