/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { MintHandlerDependencies, MintUser } from '#root/backend/mint-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildMintHandler } from '#root/backend/mint-handler'

// Defaults mirror config: base=0, step=500, cap=100000.
const FLOOR = { base: 0n, step: 500n, cap: 100_000n }

interface PersistCall {
  userId: number
  image: string
  description: string
}

interface MintTestContext {
  app: ReturnType<typeof fastify>
  persistCalls: PersistCall[]
  generateImageCalls: MintUser[]
  generateDescriptionCalls: MintUser[]
  queuePositionCalls: bigint[]
}

function baseUser(overrides: Partial<MintUser> = {}): MintUser {
  return {
    id: 1001,
    votes: 0n,
    state: 'WaitNothing',
    minted: false,
    avatar: '/data/alice/avatar.png',
    name: 'alice',
    ...overrides,
  }
}

async function createContext(
  user: MintUser | null,
  overrides: Partial<MintHandlerDependencies> = {},
  mintedCount = 0,
): Promise<MintTestContext> {
  const persistCalls: PersistCall[] = []
  const generateImageCalls: MintUser[] = []
  const generateDescriptionCalls: MintUser[] = []
  const queuePositionCalls: bigint[] = []

  const dependencies: MintHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findMintUser: async () => user,
    countMinted: async () => mintedCount,
    queuePosition: async (votes) => {
      queuePositionCalls.push(votes)
      return 3
    },
    floorParams: () => FLOOR,
    generateImage: async (u) => {
      generateImageCalls.push(u)
      return '/data/alice/alice_0.png'
    },
    generateDescription: async (u) => {
      generateDescriptionCalls.push(u)
      return 'An inspiring journey begins.'
    },
    persistDraft: async (userId, image, description) => {
      persistCalls.push({ userId, image, description })
    },
    logError: () => {},
    ...overrides,
  }

  const app = fastify()
  await app.register(buildMintHandler(dependencies), { prefix: '/api/mint' })
  return {
    app,
    persistCalls,
    generateImageCalls,
    generateDescriptionCalls,
    queuePositionCalls,
  }
}

// QUOTE — floor + eligibility

test('POST /quote returns floor, votes, and eligible=false below the floor', async (t) => {
  // 10 minted → floor = 500*10 = 5000; user has 4999 → not eligible
  const ctx = await createContext(baseUser({ votes: 4_999n }), {}, 10)
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/quote',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.floorVotes, '5000')
  assert.equal(body.yourVotes, '4999')
  assert.equal(body.mintedCount, 10)
  assert.equal(body.eligible, false)
  assert.equal(body.queuePosition, undefined, 'no rank when ineligible')
  assert.equal(ctx.queuePositionCalls.length, 0)
})

test('POST /quote returns eligible=true at the floor and includes queuePosition', async (t) => {
  // 10 minted → floor 5000; user has exactly 5000 → eligible
  const ctx = await createContext(baseUser({ votes: 5_000n }), {}, 10)
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/quote',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.floorVotes, '5000')
  assert.equal(body.eligible, true)
  assert.equal(body.queuePosition, 3)
  assert.deepEqual(ctx.queuePositionCalls, [5_000n])
})

test('POST /quote returns User not found for an unknown user', async (t) => {
  const ctx = await createContext(null)
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/quote',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'User not found')
})

// GENERATE — runs generation, persists draft + Submited

test('POST /generate invokes both generation deps and persists the draft', async (t) => {
  const ctx = await createContext(baseUser())
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.image, '/data/alice/alice_0.png')
  assert.equal(body.description, 'An inspiring journey begins.')
  assert.equal(ctx.generateImageCalls.length, 1, 'image generated once')
  assert.equal(ctx.generateDescriptionCalls.length, 1, 'description generated once')
  assert.deepEqual(ctx.persistCalls, [
    {
      userId: 1001,
      image: '/data/alice/alice_0.png',
      description: 'An inspiring journey begins.',
    },
  ])
})

test('POST /generate refuses to regenerate for an already-minted user', async (t) => {
  const ctx = await createContext(baseUser({ minted: true }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'Already minted')
  assert.equal(ctx.generateImageCalls.length, 0, 'no generation when minted')
  assert.equal(ctx.persistCalls.length, 0)
})

test('POST /generate requires an avatar', async (t) => {
  const ctx = await createContext(baseUser({ avatar: undefined }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })
  assert.match(res.json().error, /avatar/i)
  assert.equal(ctx.generateImageCalls.length, 0)
})

// STATUS — Rework allows regenerate; minted reports nftUrl

test('POST /status lets a returned (Rework) user regenerate', async (t) => {
  const ctx = await createContext(
    baseUser({ state: 'Rework', image: '/data/alice/alice_0.png', description: 'old' }),
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/status',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.state, 'Rework')
  assert.equal(body.minted, false)
  assert.equal(body.canGenerate, true, 'Rework allows re-generate')
  assert.equal(body.image, '/data/alice/alice_0.png')
  assert.equal(body.description, 'old')
})

test('POST /status reports minted + nftUrl and blocks regenerate once minted', async (t) => {
  const ctx = await createContext(
    baseUser({
      state: 'Submited',
      minted: true,
      nftUrl: 'https://getgems.io/nft/abc',
      votes: 6_000n,
    }),
    {},
    10, // floor 5000 → eligible
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/status',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.minted, true)
  assert.equal(body.nftUrl, 'https://getgems.io/nft/abc')
  assert.equal(body.canGenerate, false, 'minted blocks re-generate')
  assert.equal(body.eligible, true)
  assert.equal(body.floorVotes, '5000')
})
