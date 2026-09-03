/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { MintHandlerDependencies, MintUser } from '#root/backend/mint-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildMintHandler } from '#root/backend/mint-handler'

const TRY_COST = 100n

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
  debitCalls: number[]
  refundCalls: number[]
  submitCalls: number[]
  notifyCalls: MintUser[]
}

function baseUser(overrides: Partial<MintUser> = {}): MintUser {
  return {
    id: 1001,
    votes: 500n,
    state: 'WaitNothing',
    minted: false,
    avatar: '/data/alice/source.png',
    wallet: 'EQalice',
    name: 'alice',
    ...overrides,
  }
}

async function createContext(
  user: MintUser | null,
  overrides: Partial<MintHandlerDependencies> = {},
): Promise<MintTestContext> {
  const persistCalls: PersistCall[] = []
  const generateImageCalls: MintUser[] = []
  const generateDescriptionCalls: MintUser[] = []
  const debitCalls: number[] = []
  const refundCalls: number[] = []
  const submitCalls: number[] = []
  const notifyCalls: MintUser[] = []

  const dependencies: MintHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findMintUser: async () => user,
    tryCost: () => TRY_COST,
    debitTry: async (userId) => {
      debitCalls.push(userId)
      const votes = user?.votes ?? 0n
      return votes >= TRY_COST ? votes - TRY_COST : null
    },
    refundTry: async (userId) => {
      refundCalls.push(userId)
    },
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
    submitDraft: async (userId) => {
      submitCalls.push(userId)
    },
    notifyAdmins: async (u) => {
      notifyCalls.push(u)
    },
    readImageDataUrl: async (path) => `data:image/png;base64,${path}`,
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
    debitCalls,
    refundCalls,
    submitCalls,
    notifyCalls,
  }
}

// QUOTE — price + affordability

test('POST /quote returns the try cost and canAfford=true when covered', async (t) => {
  const ctx = await createContext(baseUser({ votes: 100n }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/quote',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.tryCost, '100')
  assert.equal(body.yourVotes, '100')
  assert.equal(body.canAfford, true)
  assert.equal(body.minted, false)
})

test('POST /quote returns canAfford=false below the try cost', async (t) => {
  const ctx = await createContext(baseUser({ votes: 99n }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/quote',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().canAfford, false)
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

// GENERATE — paid try: debit → generate → persist (no state flip to review)

test('POST /generate debits one try, generates, persists, and returns the new balance', async (t) => {
  const ctx = await createContext(baseUser({ votes: 500n }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.deepEqual(ctx.debitCalls, [1001], 'debited exactly once')
  assert.equal(body.image, 'data:image/png;base64,/data/alice/alice_0.png')
  assert.equal(body.description, 'An inspiring journey begins.')
  assert.equal(body.yourVotes, '400', 'balance after the paid try')
  assert.equal(ctx.generateImageCalls.length, 1)
  assert.equal(ctx.generateDescriptionCalls.length, 1)
  assert.deepEqual(ctx.persistCalls, [
    {
      userId: 1001,
      image: '/data/alice/alice_0.png',
      description: 'An inspiring journey begins.',
    },
  ])
  assert.equal(ctx.refundCalls.length, 0, 'no refund on success')
})

test('POST /generate rejects when the balance does not cover a try', async (t) => {
  const ctx = await createContext(baseUser({ votes: 99n }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.error, 'Not enough $CUBE')
  assert.equal(body.tryCost, '100')
  assert.equal(ctx.generateImageCalls.length, 0, 'no generation without funds')
  assert.equal(ctx.persistCalls.length, 0)
})

test('POST /generate refunds the try when generation fails', async (t) => {
  const ctx = await createContext(baseUser({ votes: 500n }), {
    generateImage: async () => {
      throw new Error('stability down')
    },
  })
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })

  assert.match(res.json().error, /refunded/i)
  assert.deepEqual(ctx.debitCalls, [1001], 'debit happened')
  assert.deepEqual(ctx.refundCalls, [1001], 'refund compensates the debit')
  assert.equal(ctx.persistCalls.length, 0, 'nothing persisted on failure')
})

test('POST /generate refuses for an already-minted user without debiting', async (t) => {
  const ctx = await createContext(baseUser({ minted: true }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'Already minted')
  assert.equal(ctx.debitCalls.length, 0, 'no debit when minted')
})

test('POST /generate refuses while the draft is under review', async (t) => {
  const ctx = await createContext(baseUser({ state: 'Submited' }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'Draft is under review')
  assert.equal(ctx.debitCalls.length, 0)
})

test('POST /generate requires an avatar and does not debit without one', async (t) => {
  const ctx = await createContext(baseUser({ avatar: undefined }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/generate',
    payload: { initData: 'signed' },
  })
  assert.match(res.json().error, /avatar/i)
  assert.equal(ctx.debitCalls.length, 0)
})

// SUBMIT — user liked the draft → Submited + admin push

test('POST /submit flips the draft to Submited and notifies admins', async (t) => {
  const ctx = await createContext(
    baseUser({ image: '/data/alice/alice_0.png', description: 'desc' }),
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/submit',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.state, 'Submited')
  assert.deepEqual(ctx.submitCalls, [1001])
  assert.equal(ctx.notifyCalls.length, 1, 'admins notified once')
})

test('POST /submit succeeds even when the admin notification fails', async (t) => {
  const ctx = await createContext(
    baseUser({ image: '/data/alice/alice_0.png', description: 'desc' }),
    {
      notifyAdmins: async () => {
        throw new Error('telegram down')
      },
    },
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/submit',
    payload: { initData: 'signed' },
  })

  assert.equal(res.json().ok, true, 'submit is not failed by notify errors')
  assert.deepEqual(ctx.submitCalls, [1001])
})

test('POST /submit requires a generated draft', async (t) => {
  const ctx = await createContext(baseUser())
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/submit',
    payload: { initData: 'signed' },
  })
  assert.match(res.json().error, /generate/i)
  assert.equal(ctx.submitCalls.length, 0)
})

test('POST /submit requires a bound wallet', async (t) => {
  const ctx = await createContext(
    baseUser({
      image: '/data/alice/alice_0.png',
      description: 'desc',
      wallet: undefined,
    }),
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/submit',
    payload: { initData: 'signed' },
  })
  assert.match(res.json().error, /wallet/i)
  assert.equal(ctx.submitCalls.length, 0)
})

test('POST /submit rejects a repeat submission', async (t) => {
  const ctx = await createContext(
    baseUser({
      state: 'Submited',
      image: '/data/alice/alice_0.png',
      description: 'desc',
    }),
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/submit',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'Already submitted')
  assert.equal(ctx.submitCalls.length, 0)
})

// STATUS — flow snapshot for the webview

test('POST /status reports a declined (Rework) draft as regenerable', async (t) => {
  const ctx = await createContext(
    baseUser({
      state: 'Rework',
      image: '/data/alice/alice_0.png',
      description: 'old',
    }),
  )
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/status',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.state, 'Rework')
  assert.equal(body.canGenerate, true, 'declined drafts can regenerate')
  assert.equal(body.image, 'data:image/png;base64,/data/alice/alice_0.png')
  assert.equal(body.description, 'old')
  assert.equal(body.hasWallet, true)
})

test('POST /status blocks generation while under review and once minted', async (t) => {
  const submitted = await createContext(baseUser({ state: 'Submited' }))
  t.after(() => submitted.app.close())
  const minted = await createContext(
    baseUser({ minted: true, nftUrl: 'https://getgems.io/nft/abc' }),
  )
  t.after(() => minted.app.close())

  const submittedBody = (
    await submitted.app.inject({
      method: 'POST',
      url: '/api/mint/status',
      payload: { initData: 'signed' },
    })
  ).json()
  assert.equal(submittedBody.canGenerate, false, 'review locks generation')

  const mintedBody = (
    await minted.app.inject({
      method: 'POST',
      url: '/api/mint/status',
      payload: { initData: 'signed' },
    })
  ).json()
  assert.equal(mintedBody.canGenerate, false, 'minted locks generation')
  assert.equal(mintedBody.nftUrl, 'https://getgems.io/nft/abc')
})

test('POST /status exposes cost, balance, and avatar preview', async (t) => {
  const ctx = await createContext(baseUser({ votes: 250n }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/status',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.tryCost, '100')
  assert.equal(body.yourVotes, '250')
  assert.equal(body.canAfford, true)
  assert.equal(body.avatar, 'data:image/png;base64,/data/alice/source.png')
})
