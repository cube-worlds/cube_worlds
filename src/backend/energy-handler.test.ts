/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { EnergyHandlerDependencies } from '#root/backend/energy-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildEnergyHandler } from '#root/backend/energy-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

function makeDeps(overrides: Partial<EnergyHandlerDependencies> = {}) {
  const calls = { addPoints: [] as Array<{ add: bigint, reason: BalanceChangeType }>, granted: [] as number[] }
  const deps: EnergyHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async (id) => (id === 7 ? ({ id: 7, _id: 'u7', votes: 10_000n } as any) : null),
    addPoints: async (_id, add, reason) => { calls.addPoints.push({ add, reason }); return 9_500n },
    grantEnergy: async (_u, amount) => { calls.granted.push(amount); return 90 + amount },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: EnergyHandlerDependencies) {
  const app = fastify()
  await app.register(buildEnergyHandler(d), { prefix: '/api/game' })
  return app
}

test('refill debits CUBE (Spend) and grants energy', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/energy/refill', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.energy, 120) // 90 + 30
  assert.equal(calls.addPoints[0].add, -500n)
  assert.equal(calls.addPoints[0].reason, BalanceChangeType.Spend)
  assert.deepEqual(calls.granted, [30])
})

test('refill rejected when the user cannot afford it (no energy granted)', async (t) => {
  const { deps, calls } = makeDeps({
    findUserById: async () => ({ id: 7, _id: 'u7', votes: 100n } as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/energy/refill', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.addPoints.length, 0)
  assert.equal(calls.granted.length, 0)
})
