/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { ProductionHandlerDependencies } from '#root/backend/production-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildProductionHandler } from '#root/backend/production-handler'
import { PRODUCTION_TICK_MS } from '#root/common/helpers/production'

function makeDeps(overrides: Partial<ProductionHandlerDependencies> = {}) {
  const calls = { credited: [] as any[], ledger: [] as any[] }
  const castle = {
    _id: 'c7',
    userId: 7,
    walls: 0, forge: 0, tavern: 0, mine: 0,
    gold: 1000, iron: 0, mana: 0, food: 0,
    lastProductionAt: new Date(0),
  }
  const deps: ProductionHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, minted: true } as any) : null),
    findOrCreateCastle: async () => castle as any,
    now: () => new Date(PRODUCTION_TICK_MS),
    creditProduction: async (_id, _expected, gained, next) => { calls.credited.push({ gained, next }); return true },
    addResourceRecords: async (userId, rows) => { calls.ledger.push({ userId, rows }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls, castle }
}

async function appWith(d: ProductionHandlerDependencies) {
  const app = fastify()
  await app.register(buildProductionHandler(d), { prefix: '/api/game' })
  return app
}

test('GET-style /castle returns status with claimable for a founder', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.isFounder, true)
  assert.equal(body.resources.gold, 1000)
  assert.equal(body.claimable.gold, 60)
  assert.equal(body.tracks.mine, 0)
})

test('/castle/claim credits production, writes ledger, advances clock', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/claim', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.claimed.gold, 60)
  assert.equal(calls.credited.length, 1)
  assert.equal(calls.credited[0].next.getTime(), PRODUCTION_TICK_MS)
  assert.equal(calls.ledger[0].rows.length, 4)
})

test('/castle/claim with nothing accrued is a no-op (no ledger write)', async (t) => {
  const { deps, calls } = makeDeps({ now: () => new Date(1) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/claim', payload: { initData: 'x' } })
  assert.equal(res.json().claimed.gold, 0)
  assert.equal(calls.credited.length, 0)
  assert.equal(calls.ledger.length, 0)
})

test('unknown user is rejected', async (t) => {
  const { deps } = makeDeps({ findUserById: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'User not found in database')
})

test('/castle/claim that loses the credit CAS writes no ledger and claims nothing', async (t) => {
  const { deps, calls } = makeDeps({ creditProduction: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/claim', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.claimed.gold, 0)
  assert.equal(body.ticks, 0)
  assert.equal(calls.ledger.length, 0)
})
