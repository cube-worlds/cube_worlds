/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { HeroHandlerDependencies } from '#root/backend/hero-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildHeroHandler } from '#root/backend/hero-handler'

function makeDeps(overrides: Partial<HeroHandlerDependencies> = {}) {
  const calls = { debited: [] as any[], refunds: [] as any[], gold: [] as any[], created: [] as any[], ledger: [] as any[] }
  let balance = 100_000n
  const deps: HeroHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, minted: true } as any) : null),
    findOrCreateCastle: async () => ({ _id: 'c7', userId: 7, tavern: 0, gold: 10_000, iron: 0, mana: 0, food: 0 } as any),
    countHeroesByUser: async () => 0,
    findHeroesByUser: async () => [],
    debitVotes: async (_id, amount) => { if (balance < amount) return null; balance -= amount; calls.debited.push({ amount }); return balance },
    addPoints: async (_id, add) => { balance += add; calls.refunds.push({ add }); return balance },
    spendResources: async (_id, cost) => { calls.gold.push(cost); return true },
    addResourceRecords: async (userId, rows) => { calls.ledger.push({ userId, rows }) },
    createHero: async input => { calls.created.push(input); return ({ _id: 'h1', ...input, level: 1, xp: 0 } as any) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: HeroHandlerDependencies) {
  const app = fastify()
  await app.register(buildHeroHandler(d), { prefix: '/api/game' })
  return app
}

test('recruit debits CUBE (Recruit) + Gold, creates a soulbound founder first hero', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/recruit', payload: { initData: 'x', heroClass: 'knight' } })
  const body = res.json()
  assert.equal(body.hero.heroClass, 'knight')
  assert.equal(calls.debited[0].amount, 1000n)
  assert.equal(calls.created[0].soulbound, true)
  assert.equal(calls.created[0].founderVariant, true)
  assert.equal(calls.gold[0].gold, 300)
  assert.equal(calls.ledger[0].rows[0].amount, -300)
})

test('recruit rejects an invalid class', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/recruit', payload: { initData: 'x', heroClass: 'wizard' } })
  assert.equal(res.json().error, 'Invalid hero class')
  assert.equal(calls.debited.length, 0)
})

test('recruit rejects at Tavern capacity', async (t) => {
  const { deps, calls } = makeDeps({ countHeroesByUser: async () => 1 }) // cap at tavern 0 is 1
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/recruit', payload: { initData: 'x', heroClass: 'mage' } })
  assert.equal(res.json().error, 'Tavern at capacity')
  assert.equal(calls.debited.length, 0)
})

test('recruit rejects when CUBE is insufficient (atomic)', async (t) => {
  const { deps, calls } = makeDeps({ debitVotes: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/recruit', payload: { initData: 'x', heroClass: 'mage' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.gold.length, 0)
  assert.equal(calls.created.length, 0)
})

test('recruit refunds CUBE when the Gold debit loses', async (t) => {
  const { deps, calls } = makeDeps({ spendResources: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/recruit', payload: { initData: 'x', heroClass: 'rogue' } })
  assert.equal(res.json().error, 'Not enough Gold')
  assert.equal(calls.debited[0].amount, 1000n)
  assert.equal(calls.refunds[0].add, 1000n)
  assert.equal(calls.created.length, 0)
})

test('heroes lists the user roster', async (t) => {
  const { deps } = makeDeps({ findHeroesByUser: async () => [{ _id: 'h1', heroClass: 'knight', level: 2, xp: 150, soulbound: true } as any] })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/heroes', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.heroes.length, 1)
  assert.equal(body.heroes[0].level, 2)
})
