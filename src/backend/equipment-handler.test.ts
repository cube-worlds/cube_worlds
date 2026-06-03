/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { EquipmentHandlerDependencies } from '#root/backend/equipment-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildEquipmentHandler } from '#root/backend/equipment-handler'

function makeDeps(overrides: Partial<EquipmentHandlerDependencies> = {}) {
  const calls = { equipped: [] as any[], unequipped: [] as any[] }
  const deps: EquipmentHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7 } as any) : null),
    findHeroForUser: async (_u, id) => (id === 'h1' ? ({ _id: 'h1' } as any) : null),
    findEquipmentByUser: async () => [
      { _id: 'e1', slot: 'weapon', rarity: 'rare', bonusHp: 0, bonusAtk: 12, bonusDef: 1, equippedHeroId: null, nftMinted: false },
    ],
    equipItem: async (_u, id, hero) => { calls.equipped.push({ id, hero }); return 'ok' },
    unequipItem: async (_u, id) => { calls.unequipped.push(id); return true },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: EquipmentHandlerDependencies) {
  const app = fastify()
  await app.register(buildEquipmentHandler(d), { prefix: '/api/game' })
  return app
}

test('GET inventory lists items with their bonus', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/equipment', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.items.length, 1)
  assert.deepEqual(body.items[0].bonus, { hp: 0, atk: 12, def: 1 })
})

test('equip succeeds for an owned hero + item', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/equipment/equip', payload: { initData: 'x', equipmentId: 'e1', heroId: 'h1' } })
  assert.equal(res.json().ok, true)
  assert.deepEqual(calls.equipped, [{ id: 'e1', hero: 'h1' }])
})

test('equip rejects a hero the user does not own', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/equipment/equip', payload: { initData: 'x', equipmentId: 'e1', heroId: 'nope' } })
  assert.equal(res.json().error, 'Hero not found')
  assert.equal(calls.equipped.length, 0)
})

test('equip maps slot-occupied and not-available results', async (t) => {
  const occupied = makeDeps({ equipItem: async () => 'slot-occupied' })
  const a = await appWith(occupied.deps)
  t.after(() => a.close())
  const r1 = await a.inject({ method: 'POST', url: '/api/game/equipment/equip', payload: { initData: 'x', equipmentId: 'e1', heroId: 'h1' } })
  assert.match(r1.json().error, /slot is already filled/)

  const unavailable = makeDeps({ equipItem: async () => 'not-available' })
  const b = await appWith(unavailable.deps)
  t.after(() => b.close())
  const r2 = await b.inject({ method: 'POST', url: '/api/game/equipment/equip', payload: { initData: 'x', equipmentId: 'e1', heroId: 'h1' } })
  assert.match(r2.json().error, /not available/)
})

test('unequip succeeds, and reports when nothing was equipped', async (t) => {
  const ok = makeDeps()
  const a = await appWith(ok.deps)
  t.after(() => a.close())
  const r1 = await a.inject({ method: 'POST', url: '/api/game/equipment/unequip', payload: { initData: 'x', equipmentId: 'e1' } })
  assert.equal(r1.json().ok, true)

  const noop = makeDeps({ unequipItem: async () => false })
  const b = await appWith(noop.deps)
  t.after(() => b.close())
  const r2 = await b.inject({ method: 'POST', url: '/api/game/equipment/unequip', payload: { initData: 'x', equipmentId: 'e1' } })
  assert.equal(r2.json().error, 'Item not equipped')
})
