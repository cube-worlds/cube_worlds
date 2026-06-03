/* eslint-disable test/no-import-node-test */
import type { HeroMintDependencies } from '#root/backend/hero-mint'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHeroMintRunner, planHeroMints } from '#root/backend/hero-mint'

test('planHeroMints caps the batch', () => {
  const u = [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }, { _id: 'c', userId: 3 }]
  assert.deepEqual(planHeroMints(u, 2), [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }])
})

function makeDeps(overrides: Partial<HeroMintDependencies> = {}) {
  const calls = { minted: [] as number[], flipped: [] as any[] }
  const deps: HeroMintDependencies = {
    batchSize: 10,
    findUnmintedHeroes: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintHeroNft: async (heroId, userId) => { calls.minted.push(userId); return `EQhero${userId}` },
    markHeroMinted: async (heroId, address) => { calls.flipped.push({ heroId, address }) },
    logInfo: () => {},
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

test('runner mints each unminted hero then flips the flag', async () => {
  const { deps, calls } = makeDeps()
  await buildHeroMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [1, 2])
  assert.equal(calls.flipped.length, 2)
})

test('a mint failure does not flip the flag and does not abort the batch', async () => {
  const { deps, calls } = makeDeps({ mintHeroNft: async (heroId, userId) => { if (userId === 1) throw new Error('chain'); calls.minted.push(userId); return `EQ${userId}` } })
  await buildHeroMintRunner(deps).runOnce()
  assert.deepEqual(calls.minted, [2])
  assert.equal(calls.flipped.length, 1)
})

test('runOnce is re-entrancy-guarded: an overlapping call is a no-op', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => { release = r })
  const calls = { minted: [] as number[] }
  const deps: HeroMintDependencies = {
    batchSize: 10,
    findUnmintedHeroes: async () => [{ _id: 'a', userId: 1 }, { _id: 'b', userId: 2 }],
    mintHeroNft: async (heroId, userId) => { await gate; calls.minted.push(userId); return `EQ${userId}` },
    markHeroMinted: async () => {},
    logInfo: () => {},
    logError: () => {},
  }
  const runner = buildHeroMintRunner(deps)
  const first = runner.runOnce()
  const second = runner.runOnce()
  await second
  release()
  await first
  assert.deepEqual(calls.minted.sort((a, b) => a - b), [1, 2])
})
