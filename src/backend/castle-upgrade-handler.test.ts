/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { CastleUpgradeHandlerDependencies } from '#root/backend/castle-upgrade-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildCastleUpgradeHandler } from '#root/backend/castle-upgrade-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

function makeDeps(overrides: Partial<CastleUpgradeHandlerDependencies> = {}) {
  const calls = { addPoints: [] as any[], spend: [] as any[], ledger: [] as any[] }
  const castle = {
    _id: 'c7', userId: 7, walls: 0, forge: 0, tavern: 0, mine: 0,
    gold: 10_000, iron: 10_000, mana: 10_000, food: 10_000,
  }
  const deps: CastleUpgradeHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, votes: 100_000n } as any) : null),
    findOrCreateCastle: async () => castle as any,
    addPoints: async (_id, add, reason) => { calls.addPoints.push({ add, reason }); return 99_500n },
    spendForUpgrade: async (_id, cost, track) => { calls.spend.push({ cost, track }); return true },
    addResourceRecords: async (userId, rows) => { calls.ledger.push({ userId, rows }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls, castle }
}

async function appWith(d: CastleUpgradeHandlerDependencies) {
  const app = fastify()
  await app.register(buildCastleUpgradeHandler(d), { prefix: '/api/game' })
  return app
}

test('upgrade debits CUBE (CastleUpgrade) then resources, writes ledger', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/upgrade', payload: { initData: 'x', track: 'mine' } })
  const body = res.json()
  assert.equal(body.track, 'mine')
  assert.equal(body.newLevel, 1)
  assert.equal(calls.addPoints[0].add, -500n)
  assert.equal(calls.addPoints[0].reason, BalanceChangeType.CastleUpgrade)
  assert.equal(calls.spend[0].track, 'mine')
  assert.equal(calls.ledger[0].rows.every((r: any) => r.amount <= 0), true)
})

test('rejects an invalid track', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/upgrade', payload: { initData: 'x', track: 'moat' } })
  assert.equal(res.json().error, 'Invalid upgrade track')
  assert.equal(calls.addPoints.length, 0)
})

test('rejects when CUBE is insufficient before any debit', async (t) => {
  const { deps, calls } = makeDeps({ findUserById: async () => ({ id: 7, votes: 100n } as any) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/upgrade', payload: { initData: 'x', track: 'mine' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.addPoints.length, 0)
  assert.equal(calls.spend.length, 0)
})

test('refunds CUBE when the resource CAS loses', async (t) => {
  const { deps, calls } = makeDeps({ spendForUpgrade: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/upgrade', payload: { initData: 'x', track: 'mine' } })
  assert.equal(res.json().error, 'Not enough resources')
  assert.equal(calls.addPoints[0].add, -500n)
  assert.equal(calls.addPoints[1].add, 500n)
  assert.equal(calls.ledger.length, 0)
})

test('rejects upgrading past max level', async (t) => {
  const { deps } = makeDeps({
    findOrCreateCastle: async () => ({ _id: 'c7', userId: 7, mine: 10, gold: 0, iron: 0, mana: 0, food: 0 } as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/castle/upgrade', payload: { initData: 'x', track: 'mine' } })
  assert.equal(res.json().error, 'Track is already at max level')
})
