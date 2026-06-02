/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { AdRewardHandlerDependencies } from '#root/backend/ad-reward-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildAdRewardHandler } from '#root/backend/ad-reward-handler'
import { issueAdNonce, verifyAdNonce } from '#root/common/helpers/ad-nonce'

const SECRET = 'test-secret'

function makeDeps(overrides: Partial<AdRewardHandlerDependencies> = {}) {
  const calls = {
    granted: [] as number[],
    recorded: [] as any[],
    accruals: [] as any[],
  }
  const deps: AdRewardHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, _id: 'u7' } as any) : null),
    adBlockId: () => 'block-1',
    issueAdNonce: userId => issueAdNonce(SECRET, userId, 1_000_000),
    verifyAdNonce: (payload, now) => verifyAdNonce(SECRET, payload, now),
    utcDay: () => '2026-06-03',
    countAdGrantsToday: async () => 0,
    recordAdGrant: async (g) => { calls.recorded.push(g) },
    grantEnergy: async (_u, amount) => { calls.granted.push(amount); return amount },
    accrueRewards: async (e) => { calls.accruals.push(e) },
    adRevenueMicro: () => 3000n,
    accrueShare: micro => micro / 5n, // 20%
    now: () => 1_000_500,
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: AdRewardHandlerDependencies) {
  const app = fastify()
  await app.register(buildAdRewardHandler(d), { prefix: '/api/game' })
  return app
}

test('POST /ad-nonce issues a nonce + block id', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/ad-nonce', payload: { initData: 'x' } })
  const b = res.json()
  assert.equal(b.blockId, 'block-1')
  assert.ok(typeof b.payload === 'string' && b.payload.split(':').length === 4)
})

test('valid nonce within cap grants energy, records the grant, accrues revenue', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const { payload } = deps.issueAdNonce(7)
  const res = await app.inject({ method: 'GET', url: `/api/game/ad-reward?payload=${encodeURIComponent(payload)}` })
  assert.deepEqual(res.json(), { ok: true })
  assert.deepEqual(calls.granted, [20])
  assert.equal(calls.recorded.length, 1)
  assert.equal(calls.accruals[0].amount, 600n) // 20% of 3000
  assert.equal(calls.accruals[0].externalId.startsWith('accrual:ad:'), true)
})

test('tampered nonce is rejected with 403, no grant', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'GET', url: '/api/game/ad-reward?payload=bogus:1:2:3' })
  assert.equal(res.statusCode, 403)
  assert.equal(calls.granted.length, 0)
})

test('replayed nonce (E11000) returns ok without a second grant', async (t) => {
  const { deps, calls } = makeDeps({
    recordAdGrant: async () => { throw Object.assign(new Error('dup'), { code: 11000 }) },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const { payload } = deps.issueAdNonce(7)
  const res = await app.inject({ method: 'GET', url: `/api/game/ad-reward?payload=${encodeURIComponent(payload)}` })
  assert.deepEqual(res.json(), { ok: true })
  assert.equal(calls.granted.length, 0)
})

test('over the daily cap returns reason:cap, no grant', async (t) => {
  const { deps, calls } = makeDeps({ countAdGrantsToday: async () => 5 })
  const app = await appWith(deps)
  t.after(() => app.close())
  const { payload } = deps.issueAdNonce(7)
  const res = await app.inject({ method: 'GET', url: `/api/game/ad-reward?payload=${encodeURIComponent(payload)}` })
  assert.deepEqual(res.json(), { ok: false, reason: 'cap' })
  assert.equal(calls.granted.length, 0)
  assert.equal(calls.recorded.length, 0)
})
