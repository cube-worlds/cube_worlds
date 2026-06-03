/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { DungeonHandlerDependencies } from '#root/backend/dungeon-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildDungeonHandler } from '#root/backend/dungeon-handler'

function makeDeps(overrides: Partial<DungeonHandlerDependencies> = {}) {
  const calls = { credited: [] as any[], looted: [] as any[], ledger: [] as any[], xp: [] as any[], claimed: [] as any[] }
  const hero = { _id: 'h1', userId: 7, heroClass: 'knight', level: 1, xp: 0 }
  const deps: DungeonHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7 } as any) : null),
    findOrCreateCastle: async () => ({ _id: 'c7', userId: 7 } as any),
    findHeroForUser: async (_u, id) => (id === 'h1' ? hero as any : null),
    findEquippedForHero: async () => [],
    findActiveQuestForHero: async () => null,
    now: () => new Date(86_400_000 * 19876),
    findDungeonRun: async () => null,
    claimDungeonRun: async (input) => { calls.claimed.push(input); return ({ _id: 'r1', ...input, credited: false } as any) },
    claimDungeonCredit: async (id) => { calls.credited.push(id); return true },
    creditResources: async (_c, loot) => { calls.looted.push(loot) },
    addResourceRecords: async (u, rows) => { calls.ledger.push({ u, rows }) },
    grantHeroXp: async (id, xp, level) => { calls.xp.push({ id, xp, level }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls, hero }
}

async function appWith(d: DungeonHandlerDependencies) {
  const app = fastify()
  await app.register(buildDungeonHandler(d), { prefix: '/api/game' })
  return app
}

test('dungeon/run resolves, claims the day, credits loot+XP once, returns rounds', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })
  const body = res.json()
  assert.equal(typeof body.win, 'boolean')
  assert.ok(Array.isArray(body.rounds))
  assert.equal(calls.claimed.length, 1)
  assert.equal(calls.credited.length, 1)
  assert.equal(calls.xp.length, 1)
  if (body.win) {
    assert.equal(calls.looted.length, 1)
    assert.equal(calls.ledger.length, 1)
  }
})

test('dungeon/run is deterministic: a re-run of the same day returns the stored result and credits nothing', async (t) => {
  const stored = { _id: 'r1', userId: 7, day: 19876, heroId: 'h1', seed: 1, win: true, lootGold: 20, lootIron: 14, lootMana: 6, lootFood: 10, xpGained: 60, credited: true }
  const { deps, calls } = makeDeps({ findDungeonRun: async () => stored as any })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })
  const body = res.json()
  assert.equal(body.alreadyRan, true)
  assert.equal(calls.claimed.length, 0)
  assert.equal(calls.credited.length, 0)
  assert.equal(calls.looted.length, 0)
})

test('dungeon/run rejects a hero the user does not own', async (t) => {
  const { deps } = makeDeps({ findHeroForUser: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'nope' } })
  assert.equal(res.json().error, 'Hero not found')
})

test('dungeon status reports whether today is already run', async (t) => {
  const { deps } = makeDeps({ findDungeonRun: async () => ({ _id: 'r1', win: true, lootGold: 20 } as any) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/dungeon', payload: { initData: 'x' } })
  assert.equal(res.json().ranToday, true)
})

test('equipped gear changes the resolved fight for the same seed', async (t) => {
  const mage = { _id: 'h1', userId: 7, heroClass: 'mage', level: 1, xp: 0 }
  const bare = makeDeps({ findHeroForUser: async () => mage as any })
  const appBare = await appWith(bare.deps)
  t.after(() => appBare.close())
  const r1 = (await appBare.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })).json()

  const geared = makeDeps({
    findHeroForUser: async () => mage as any,
    findEquippedForHero: async () => [{ bonusHp: 0, bonusAtk: 40, bonusDef: 0 }],
  })
  const appGeared = await appWith(geared.deps)
  t.after(() => appGeared.close())
  const r2 = (await appGeared.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })).json()

  // Same seed, different stats → a demonstrably different fight (gear is wired in).
  assert.notDeepEqual(r1.rounds, r2.rounds)
  assert.ok(r2.rounds.length < r1.rounds.length, 'a higher-atk hero should end the fight faster')
})

test('dungeon refuses a hero that is away on a quest', async (t) => {
  const { deps, calls } = makeDeps({ findActiveQuestForHero: async () => ({ _id: 'q1' }) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })
  assert.equal(res.json().error, 'Hero is away on a quest')
  assert.equal(calls.claimed.length, 0)
})

test('a lost-credit-CAS run (concurrent) credits nothing', async (t) => {
  const { deps, calls } = makeDeps({ claimDungeonCredit: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  await app.inject({ method: 'POST', url: '/api/game/dungeon/run', payload: { initData: 'x', heroId: 'h1' } })
  assert.equal(calls.looted.length, 0)
  assert.equal(calls.xp.length, 0)
})
