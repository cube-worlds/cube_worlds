/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { WorldHandlerDependencies, WorldUser } from '#root/backend/world-handler'
import type { VisitRecord } from '#root/common/models/Visit'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildWorldHandler } from '#root/backend/world-handler'
import { BalanceChangeType } from '#root/common/models/Balance'
import { PLACES, WINDOW_MS } from '#root/game/places'

const NOW = 100 * WINDOW_MS + 1000
const W = 100

interface Ctx {
  app: ReturnType<typeof fastify>
  user: WorldUser
  visits: VisitRecord[]
  debits: Array<[number, bigint, BalanceChangeType]>
  credits: Array<[number, bigint, BalanceChangeType]>
  traitsSet: Array<[number, object]>
  errors: string[]
}

async function createCtx(overrides: Partial<WorldHandlerDependencies> = {}, userOverrides: Partial<WorldUser> = {}): Promise<Ctx> {
  const user: WorldUser = {
    id: 1001,
    votes: 1000n,
    pass: { index: 7, address: 'EQ_A', name: 'alice', image: '', traits: { Artistry: 10, Imagination: 10, Charm: 10, Deceptiveness: 2 } },
    rep: { helped: 1, stole: 0, gave: 2, took: 0 },
    ...userOverrides,
  }
  const visits: VisitRecord[] = []
  const ctx: Ctx = { app: fastify(), user, visits, debits: [], credits: [], traitsSet: [], errors: [] }
  let seq = 0
  const deps: WorldHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001, username: 'alice' } } as InitData),
    findUser: async id => (id === 1001 ? user : null),
    findUserByPassIndex: async index => (index === 7 ? user : null),
    now: () => NOW,
    places: PLACES,
    countVisitsByPlace: async () => ({ ubud: 3 }),
    getPool: async (_p, seed) => seed + 1n,
    findVisit: async (userId, windowId) => visits.find(v => v.userId === userId && v.windowId === windowId) ?? null,
    lastResolvedVisit: async userId => visits.find(v => v.userId === userId && v.resolved) ?? null,
    findResolvedVisits: async (userId, limit) => visits.filter(v => v.userId === userId && v.resolved).slice(0, limit),
    debitVotes: async (userId, amount, reason) => {
      ctx.debits.push([userId, amount, reason])
      if (user.votes < amount) return null
      user.votes -= amount
      return user.votes
    },
    addPoints: async (userId, amount, reason) => { ctx.credits.push([userId, amount, reason]) },
    createVisit: async (input) => {
      if (visits.some(v => v.userId === input.userId && v.windowId === input.windowId)) return 'duplicate'
      seq += 1
      const v: VisitRecord = { id: `v${seq}`, resolved: false, ...input, move: input.move }
      visits.push(v)
      return v
    },
    bindInvite: async (_w, _p, code, joinerId) => {
      const host = visits.find(v => v.inviteCode === code)
      if (!host) return 'expired'
      if (host.partnerId !== undefined || host.userId === joinerId) return 'taken'
      host.partnerId = joinerId
      return { hostId: host.userId }
    },
    setPartner: async (id, partnerId) => { const v = visits.find(x => x.id === id); if (v) v.partnerId = partnerId },
    loadTraitsForPass: async () => ({ Courage: 9 }),
    setPassTraits: async (userId, traits) => { ctx.traitsSet.push([userId, traits]) },
    randomCode: () => 'CODE1234',
    logError: m => ctx.errors.push(m),
    ...overrides,
  }
  await ctx.app.register(buildWorldHandler(deps), { prefix: '/api/world' })
  return ctx
}

const post = (ctx: Ctx, url: string, payload: object = {}) =>
  ctx.app.inject({ method: 'POST', url: `/api/world${url}`, payload: { initData: 'x', ...payload } })

test('non-holders get 403 holder_required', async (t) => {
  const ctx = await createCtx({}, { pass: undefined })
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/state')
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().code, 'holder_required')
})

test('/state returns the window, places with weights, last crowd, pools and my rep', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/state')
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.windowId, W)
  assert.equal(body.endsAt, (W + 1) * WINDOW_MS)
  assert.equal(body.places.length, 14)
  const ubud = body.places.find((p: { id: string }) => p.id === 'ubud')
  assert.equal(ubud.weight, 30)
  assert.equal(ubud.lastCrowd, 3)
  assert.equal(ubud.stake, '100')
  assert.equal(ubud.pot, '1500')
  assert.deepEqual(ubud.traits, [{ name: 'Artistry', value: 10 }, { name: 'Imagination', value: 10 }, { name: 'Charm', value: 10 }])
  const besakih = body.places.find((p: { id: string }) => p.id === 'besakih')
  assert.equal(besakih.pool, '5001')
  assert.equal(body.myVisit, null)
  assert.equal(body.balance, '1000')
  assert.deepEqual(body.rep, { helped: 1, stole: 0, gave: 2, took: 0 })
})

test('/state backfills traits when the pass has none', async (t) => {
  const ctx = await createCtx({}, { pass: { index: 7, address: 'EQ_A', name: 'alice', image: '' } })
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/state')
  assert.deepEqual(ctx.traitsSet, [[1001, { Courage: 9 }]])
  const ubud = res.json().places.find((p: { id: string }) => p.id === 'ubud')
  assert.equal(ubud.weight, 15)
})

test('/state survives a failed trait backfill', async (t) => {
  const ctx = await createCtx({ loadTraitsForPass: async () => { throw new Error('ipfs down') } }, { pass: { index: 7, address: 'EQ_A', name: 'alice', image: '' } })
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/state')
  assert.equal(res.statusCode, 200)
  assert.match(ctx.errors[0], /ipfs down/)
})

test('/visit at a trail debits the fee and creates the visit', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/visit', { place: 'ubud' })
  assert.equal(res.statusCode, 201)
  assert.deepEqual(ctx.debits, [[1001, 100n, BalanceChangeType.Stake]])
  assert.equal(res.json().place, 'ubud')
  assert.equal(res.json().stake, '100')
  assert.equal(res.json().inviteCode, undefined)
})

test('/visit rejects unknown, closed and rest places', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  for (const place of ['nowhere', 'kuta', 'sanur']) {
    const res = await post(ctx, '/visit', { place })
    assert.equal(res.statusCode, 400, place)
    assert.equal(res.json().code, 'bad_place')
  }
  assert.deepEqual(ctx.debits, [])
})

test('/visit validates the move per engine', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  assert.equal((await post(ctx, '/visit', { place: 'canggu' })).json().code, 'bad_move')
  assert.equal((await post(ctx, '/visit', { place: 'canggu', move: 'give' })).json().code, 'bad_move')
  assert.equal((await post(ctx, '/visit', { place: 'ubud', move: 'help' })).json().code, 'bad_move')
  assert.deepEqual(ctx.debits, [])
})

test('/visit answers 402 no_cube when the stake is not covered', async (t) => {
  const ctx = await createCtx({}, { votes: 50n })
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/visit', { place: 'ubud' })
  assert.equal(res.statusCode, 402)
  assert.equal(res.json().code, 'no_cube')
})

test('/visit answers 409 already_visited and never double-debits', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  await post(ctx, '/visit', { place: 'ubud' })
  const res = await post(ctx, '/visit', { place: 'lovina' })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().code, 'already_visited')
  assert.equal(ctx.debits.length, 1)
})

test('/visit refunds when the unique index catches a race', async (t) => {
  const ctx = await createCtx({ findVisit: async () => null })
  t.after(() => ctx.app.close())
  await post(ctx, '/visit', { place: 'ubud' })
  const res = await post(ctx, '/visit', { place: 'ubud' })
  assert.equal(res.statusCode, 409)
  assert.deepEqual(ctx.credits, [[1001, 100n, BalanceChangeType.Stake]])
})

test('/visit at Canggu without an invite returns a fresh invite code', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/visit', { place: 'canggu', move: 'help' })
  assert.equal(res.statusCode, 201)
  assert.equal(res.json().inviteCode, '7-CODE1234')
  assert.equal(res.json().partnerId, null)
})

test('/visit at Canggu with an invite binds both partners', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  ctx.visits.push({ id: 'host', userId: 2002, windowId: W, place: 'canggu', move: 'help', stake: 200n, inviteCode: 'HOST1', resolved: false })
  const res = await post(ctx, '/visit', { place: 'canggu', move: 'steal', inviteCode: 'HOST1' })
  assert.equal(res.statusCode, 201)
  assert.equal(res.json().partnerId, 2002)
  assert.equal(ctx.visits[0].partnerId, 1001)
})

test('/visit with a dead invite is 410 and the stake is refunded', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await post(ctx, '/visit', { place: 'canggu', move: 'help', inviteCode: 'NOPE' })
  assert.equal(res.statusCode, 410)
  assert.equal(res.json().code, 'invite_expired')
  assert.deepEqual(ctx.debits, [[1001, 200n, BalanceChangeType.Stake]])
  assert.deepEqual(ctx.credits, [[1001, 200n, BalanceChangeType.Stake]])
})

test('/visit with a taken invite is 409 invite_taken and the stake is refunded', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  ctx.visits.push({ id: 'host', userId: 2002, windowId: W, place: 'canggu', move: 'help', stake: 200n, inviteCode: 'HOST1', partnerId: 3003, resolved: false })
  const res = await post(ctx, '/visit', { place: 'canggu', move: 'help', inviteCode: 'HOST1' })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().code, 'invite_taken')
  assert.deepEqual(ctx.credits, [[1001, 200n, BalanceChangeType.Stake]])
})

test('/visit with an invite but insufficient balance is 402 and never binds the invite', async (t) => {
  const ctx = await createCtx({}, { votes: 50n })
  t.after(() => ctx.app.close())
  ctx.visits.push({ id: 'host', userId: 2002, windowId: W, place: 'canggu', move: 'help', stake: 200n, inviteCode: 'HOST1', resolved: false })
  const res = await post(ctx, '/visit', { place: 'canggu', move: 'help', inviteCode: 'HOST1' })
  assert.equal(res.statusCode, 402)
  assert.equal(res.json().code, 'no_cube')
  assert.equal(ctx.visits[0].partnerId, undefined)
})

test('/history lists resolved visits with string amounts', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  ctx.visits.push({ id: 'r1', userId: 1001, windowId: W - 1, place: 'ubud', move: null, stake: 100n, resolved: true, payout: 750n, outcome: 'Ubud · 2 visitors · your share 750' })
  const res = await post(ctx, '/history', { limit: 10 })
  assert.deepEqual(res.json().visits[0], { id: 'r1', windowId: W - 1, place: 'ubud', move: null, stake: '100', partnerId: null, partnerPass: null, resolved: true, payout: '750', outcome: 'Ubud · 2 visitors · your share 750' })
})

test('/history clamps limit to 1..50', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  assert.equal((await post(ctx, '/history', { limit: 0 })).statusCode, 400)
  assert.equal((await post(ctx, '/history', { limit: 51 })).statusCode, 400)
})

test('GET /pass/:index is public and exposes rep, weights and top traits', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'GET', url: '/api/world/pass/7' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.name, 'alice')
  assert.deepEqual(body.rep, { helped: 1, stole: 0, gave: 2, took: 0 })
  assert.deepEqual(body.weights.find((w: { place: string }) => w.place === 'ubud'), { place: 'ubud', weight: 30 })
  assert.equal(body.weights.length, 7)
  assert.equal(body.top.length, 4)
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/world/pass/8' })).statusCode, 404)
})
