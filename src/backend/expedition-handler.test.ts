/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { ExpeditionHandlerDependencies } from '#root/backend/expedition-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildExpeditionHandler } from '#root/backend/expedition-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

function makeDeps(overrides: Partial<ExpeditionHandlerDependencies> = {}) {
  const calls = {
    spent: [] as number[],
    addPoints: [] as Array<{ add: bigint, reason: BalanceChangeType }>,
    commitments: [] as Array<{ worldId: string, weight: number }>,
    created: [] as any[],
  }
  const deps: ExpeditionHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async (id) => (id === 7 ? ({ id: 7, _id: 'u7', votes: 10_000n } as any) : null),
    currentTickId: () => 100,
    ensureWorldsForTick: async () => {},
    findWorld: async (_t, worldId) => (worldId === 'frostvault' ? ({ worldId } as any) : null),
    findOrCreateEnergy: async () => ({ current: 90 } as any),
    spendEnergy: async (_e, amount) => { calls.spent.push(amount); return { current: 90 - amount } as any },
    addPoints: async (_id, add, reason) => { calls.addPoints.push({ add, reason }); return 9_400n },
    createExpedition: async (input) => { calls.created.push(input); return { _id: 'e1', ...input } as any },
    addWorldCommitment: async (_t, worldId, weight) => { calls.commitments.push({ worldId, weight }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: ExpeditionHandlerDependencies) {
  const app = fastify()
  await app.register(buildExpeditionHandler(d), { prefix: '/api/game' })
  return app
}

test('sends an expedition: spends energy, records commitment, bumps crowd', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'frostvault', risk: 'safe' },
  })
  const body = res.json()
  assert.equal(body.worldId, 'frostvault')
  assert.equal(body.weight, 30) // energy cost only, no boost
  assert.deepEqual(calls.spent, [30])
  assert.deepEqual(calls.commitments, [{ worldId: 'frostvault', weight: 30 }])
  assert.equal(calls.addPoints.length, 0) // no boost -> no CUBE sink
})

test('a CUBE weight-boost debits CUBE (Spend) and raises weight', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'frostvault', risk: 'greedy', cubeBoost: 600 },
  })
  const body = res.json()
  assert.equal(body.weight, 36) // 30 + floor(600/100)
  assert.equal(calls.addPoints[0].add, -600n)
  assert.equal(calls.addPoints[0].reason, BalanceChangeType.Spend)
  // the boosted weight (not the bare energy cost) must reach the crowd counter
  assert.deepEqual(calls.commitments, [{ worldId: 'frostvault', weight: 36 }])
})

test('rejects a boost the user cannot afford', async (t) => {
  const { deps } = makeDeps({
    findUserById: async () => ({ id: 7, _id: 'u7', votes: 100n } as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'frostvault', risk: 'safe', cubeBoost: 600 },
  })
  assert.equal(res.json().error, 'Not enough CUBE')
})

test('rejects an unknown world', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'nope', risk: 'safe' },
  })
  assert.equal(res.json().error, 'Unknown world')
})

test('rejects an invalid risk value', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'frostvault', risk: 'reckless' },
  })
  assert.equal(res.json().error, 'Invalid request body')
})

test('translates a duplicate-tick commitment into a friendly error', async (t) => {
  const { deps } = makeDeps({
    createExpedition: async () => { throw Object.assign(new Error('dup key'), { code: 11000 }) },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({
    method: 'POST',
    url: '/api/game/expedition',
    payload: { initData: 'x', worldId: 'frostvault', risk: 'safe' },
  })
  assert.equal(res.json().error, 'Already sent an expedition this tick')
})
