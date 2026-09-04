/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { LoginUser, Pass } from '#root/backend/login-payload'
import type { PassHandlerDependencies } from '#root/backend/pass-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildPassHandler, MAX_PASSES, parseNftItems } from '#root/backend/pass-handler'

const PASS_A: Pass = { index: 7, address: 'EQ_A', name: 'alice', image: 'https://ipfs.io/ipfs/imgA', contentUri: 'ipfs://QmA' }
const PASS_B: Pass = { index: 9, address: 'EQ_B', name: 'bob', image: '' }

interface Ctx {
  app: ReturnType<typeof fastify>
  user: LoginUser
  setCalls: Array<{ userId: number, pass: Pass, verifiedAt: Date }>
  listCalls: string[]
  errors: string[]
}

async function createCtx(
  overrides: Partial<PassHandlerDependencies> = {},
  userOverrides: Partial<LoginUser> = {},
): Promise<Ctx> {
  const user: LoginUser = {
    id: 1001,
    language: 'en',
    wallet: 'EQ_WALLET',
    votes: BigInt(50),
    minted: false,
    state: 'WaitNothing',
    ...userOverrides,
  }
  const setCalls: Ctx['setCalls'] = []
  const listCalls: string[] = []
  const errors: string[] = []
  const deps: PassHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001, username: 'alice' } } as InitData),
    findUser: async (id) => (id === 1001 ? user : null),
    listPasses: async (owner) => {
      listCalls.push(owner)
      return [PASS_A, PASS_B]
    },
    setUserPass: async (userId, pass, verifiedAt) => {
      setCalls.push({ userId, pass, verifiedAt })
    },
    logError: (message) => {
      errors.push(message)
    },
    fetchTraits: async () => ({}),
    ...overrides,
  }
  const app = fastify()
  await app.register(buildPassHandler(deps), { prefix: '/api/pass' })
  return { app, user, setCalls, listCalls, errors }
}

test('POST /api/pass/scan requires a bound wallet', async (t) => {
  const ctx = await createCtx({}, { wallet: undefined })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/scan', payload: { initData: 'x' } })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().code, 'wallet_required')
  assert.deepEqual(ctx.listCalls, [])
})

test('POST /api/pass/scan lists passes for the bound wallet', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/scan', payload: { initData: 'x' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json().passes, [PASS_A, PASS_B])
  assert.deepEqual(ctx.listCalls, ['EQ_WALLET'])
})

test('POST /api/pass/scan caps the list at MAX_PASSES', async (t) => {
  const many = Array.from({ length: MAX_PASSES + 5 }, (_, i) => ({ ...PASS_A, index: i }))
  const ctx = await createCtx({ listPasses: async () => many })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/scan', payload: { initData: 'x' } })
  assert.equal(res.json().passes.length, MAX_PASSES)
})

test('POST /api/pass/scan surfaces a provider failure as 502 scan_failed', async (t) => {
  const ctx = await createCtx({ listPasses: async () => { throw new Error('toncenter 503') } })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/scan', payload: { initData: 'x' } })
  assert.equal(res.statusCode, 502)
  assert.equal(res.json().code, 'scan_failed')
  assert.match(ctx.errors[0], /toncenter 503/)
})

test('POST /api/pass/select rejects an index the wallet does not hold', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/select', payload: { initData: 'x', index: 42 } })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().code, 'not_owned')
  assert.deepEqual(ctx.setCalls, [])
})

test('POST /api/pass/select writes the snapshot and returns the login payload', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const before = Date.now()
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/select', payload: { initData: 'x', index: 9 } })
  assert.equal(res.statusCode, 200)
  assert.equal(ctx.setCalls.length, 1)
  assert.equal(ctx.setCalls[0].userId, 1001)
  assert.deepEqual(ctx.setCalls[0].pass, PASS_B)
  assert.ok(ctx.setCalls[0].verifiedAt.getTime() >= before)
  const body = res.json()
  assert.equal(body.holder, true)
  assert.deepEqual(body.pass, PASS_B)
  assert.equal(body.username, 'alice')
  assert.equal(body.balance, '50')
})

test('POST /api/pass/select rejects a non-integer index with the error envelope', async (t) => {
  const ctx = await createCtx()
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/select', payload: { initData: 'x', index: 'nine' } })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error, 'Invalid request body')
})

test('parseNftItems keeps the content uri for trait fetching', () => {
  const passes = parseNftItems({
    nft_items: [{ address: `0:${'a'.repeat(64)}`, index: '3', content: { uri: 'ipfs://QmX' } }],
  })
  assert.equal(passes[0].contentUri, 'ipfs://QmX')
})

test('POST /api/pass/select fetches traits and stores them on the pass', async (t) => {
  const traitCalls: string[] = []
  const ctx = await createCtx({
    listPasses: async () => [{ ...PASS_A, contentUri: 'ipfs://QmA' }],
    fetchTraits: async (uri) => {
      traitCalls.push(uri)
      return { Courage: 9 }
    },
  })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/select', payload: { initData: 'x', index: 7 } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(traitCalls, ['ipfs://QmA'])
  assert.deepEqual(ctx.setCalls[0].pass.traits, { Courage: 9 })
  assert.equal(res.json().pass.traits, undefined)
})

test('POST /api/pass/select still succeeds when the trait fetch fails', async (t) => {
  const ctx = await createCtx({ fetchTraits: async () => { throw new Error('ipfs down') } })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/pass/select', payload: { initData: 'x', index: 7 } })
  assert.equal(res.statusCode, 200)
  assert.equal(ctx.setCalls[0].pass.traits, undefined)
  assert.match(ctx.errors[0], /ipfs down/)
})

test('parseNftItems maps toncenter v3 items, metadata and ipfs images', () => {
  const raw = '0:1111111111111111111111111111111111111111111111111111111111111111'
  const passes = parseNftItems({
    nft_items: [
      { address: raw, index: '12' },
      { address: '0:2222222222222222222222222222222222222222222222222222222222222222', index: '13' },
    ],
    metadata: {
      [raw]: { token_info: [{ name: 'alice', image: 'ipfs://QmImg' }] },
    },
  })
  assert.equal(passes.length, 2)
  assert.equal(passes[0].index, 12)
  assert.equal(passes[0].name, 'alice')
  assert.equal(passes[0].image, 'https://ipfs.io/ipfs/QmImg')
  assert.match(passes[0].address, /^EQ/)
  assert.equal(passes[1].name, 'Pass #13')
  assert.equal(passes[1].image, '')
})
