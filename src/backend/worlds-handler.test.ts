/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { WorldsHandlerDependencies } from '#root/backend/worlds-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildWorldsHandler } from '#root/backend/worlds-handler'

function deps(overrides: Partial<WorldsHandlerDependencies> = {}): WorldsHandlerDependencies {
  return {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async (id) => (id === 7 ? ({ id: 7, _id: 'u7' } as any) : null),
    findOrCreateEnergy: async () => ({ current: 90, regenAt: new Date(0) }) as any,
    getEnergyStatus: () => ({ current: 90, max: 120, regenAt: new Date(0) }),
    currentTickId: () => 100,
    ensureWorldsForTick: async () => {},
    findWorldsForTick: async () => [
      { worldId: 'frostvault', name: 'Frostvault', cubePool: 5000, totalWeight: 30, explorerCount: 1 },
    ] as any,
    findMyExpeditionForTick: async () => null,
    logError: () => {},
    ...overrides,
  }
}

async function appWith(d: WorldsHandlerDependencies) {
  const app = fastify()
  await app.register(buildWorldsHandler(d), { prefix: '/api/game' })
  return app
}

test('POST /api/game/worlds returns board, energy, tick and no commitment', async (t) => {
  const app = await appWith(deps())
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/worlds', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.tickId, 100)
  assert.equal(body.energy.current, 90)
  assert.equal(body.worlds.length, 1)
  assert.equal(body.worlds[0].explorerCount, 1)
  assert.equal(body.myExpedition, null)
})

test('POST /api/game/worlds surfaces an existing commitment', async (t) => {
  const app = await appWith(deps({
    findMyExpeditionForTick: async () => ({ worldId: 'emberwild', risk: 'greedy', weight: 36 }) as any,
  }))
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/worlds', payload: { initData: 'x' } })
  assert.equal(res.json().myExpedition.worldId, 'emberwild')
})

test('POST /api/game/worlds returns error when initData missing', async (t) => {
  const app = await appWith(deps())
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/worlds', payload: {} })
  assert.equal(res.json().error, 'No initData provided')
})

test('POST /api/game/worlds returns error for unknown user', async (t) => {
  const app = await appWith(deps({ findUserById: async () => null }))
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/worlds', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'User not found in database')
})
