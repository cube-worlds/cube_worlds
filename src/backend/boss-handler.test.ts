/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { BossHandlerDependencies } from '#root/backend/boss-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildBossHandler } from '#root/backend/boss-handler'

const NOW = 86_400_000 * 19876

function makeDeps(overrides: Partial<BossHandlerDependencies> = {}) {
  const calls = { recorded: [] as any[], xp: [] as any[] }
  const hero = { _id: 'h1', heroClass: 'knight', level: 5, xp: 1000 }
  const deps: BossHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7 } as any) : null),
    findHeroForUser: async (_u, id) => (id === 'h1' ? hero as any : null),
    findEquippedForHero: async () => [],
    findActiveQuestForHero: async () => null,
    now: () => new Date(NOW),
    hasAttackedToday: async () => null,
    findUserBossDamage: async () => 0,
    aggregateDamageByUser: async () => [],
    recordBossAttack: async (input) => { calls.recorded.push(input); return { _id: 'a1' } },
    grantHeroXp: async (id, xp, level) => { calls.xp.push({ id, xp, level }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls, hero }
}

async function appWith(d: BossHandlerDependencies) {
  const app = fastify()
  await app.register(buildBossHandler(d), { prefix: '/api/game' })
  return app
}

test('boss status reports the week boss, your damage and rank', async (t) => {
  const { deps } = makeDeps({
    findUserBossDamage: async () => 500,
    aggregateDamageByUser: async () => [{ userId: 9, total: 900 }, { userId: 7, total: 500 }],
    hasAttackedToday: async () => ({ _id: 'a1' }),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/boss', payload: { initData: 'x' } })).json()
  assert.ok(body.boss.hp > 0)
  assert.equal(body.yourDamage, 500)
  assert.equal(body.yourRank, 2)
  assert.equal(body.contributors, 2)
  assert.equal(body.attackedToday, true)
})

test('attack records damage + grants XP', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/boss/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.ok(body.damage > 0)
  assert.ok(Array.isArray(body.rounds))
  assert.equal(body.xpGained, 40)
  assert.equal(calls.recorded.length, 1)
  assert.equal(calls.recorded[0].damage, body.damage)
  assert.equal(calls.xp.length, 1)
})

test('a second attack the same day is rejected', async (t) => {
  const { deps, calls } = makeDeps({ recordBossAttack: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/boss/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Already attacked the boss today')
  assert.equal(calls.xp.length, 0)
})

test('a questing hero cannot attack the boss', async (t) => {
  const { deps, calls } = makeDeps({ findActiveQuestForHero: async () => ({ _id: 'q1' }) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/boss/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Hero is away on a quest')
  assert.equal(calls.recorded.length, 0)
})

test('gear increases the damage dealt on the same fight', async (t) => {
  const bare = makeDeps()
  const a = await appWith(bare.deps)
  t.after(() => a.close())
  const d1 = (await a.inject({ method: 'POST', url: '/api/game/boss/attack', payload: { initData: 'x', heroId: 'h1' } })).json().damage

  const geared = makeDeps({ findEquippedForHero: async () => [{ bonusHp: 0, bonusAtk: 50, bonusDef: 0 }] })
  const b = await appWith(geared.deps)
  t.after(() => b.close())
  const d2 = (await b.inject({ method: 'POST', url: '/api/game/boss/attack', payload: { initData: 'x', heroId: 'h1' } })).json().damage

  assert.ok(d2 > d1, `geared damage ${d2} should beat bare ${d1}`)
})
