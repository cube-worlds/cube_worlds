/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type {
  SetWalletHandlerDependencies,
} from '#root/backend/set-wallet-handler'
import type { VerifyResult } from '#root/backend/ton-proof'
import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'
import fastify from 'fastify'
import { buildSetWalletHandler } from '#root/backend/set-wallet-handler'

type ResolvedUser = NonNullable<
  Awaited<ReturnType<SetWalletHandlerDependencies['findUserById']>>
>

interface StubUser {
  id: number
  wallet?: string
  saveCalls: number
  save: () => Promise<void>
}

interface SetWalletTestContext {
  app: ReturnType<typeof fastify>
  user: StubUser
  unhandledErrorLogs: string[]
  verifyCalls: number
}

function toResolvedUser(user: StubUser): ResolvedUser {
  return user as unknown as ResolvedUser
}

function createStubUser(overrides: Partial<StubUser> = {}): StubUser {
  const user: StubUser = {
    id: 1001,
    wallet: undefined,
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1
    },
    ...overrides,
  }
  return user
}

const VALID_PROOF_BODY = {
  initData: 'signed',
  address: 'EQ_RAW_ADDRESS',
  publicKey: 'abcd'.repeat(16),
  walletStateInit: 'base64-state-init',
  proof: {
    timestamp: 1_700_000_000,
    domain: { lengthBytes: 15, value: 'cubeworlds.club' },
    payload: 'nonce-payload',
    signature: 'base64-sig',
  },
}

async function createSetWalletTestContext(
  overrides: Partial<SetWalletHandlerDependencies> = {},
): Promise<SetWalletTestContext> {
  const user = createStubUser()
  const unhandledErrorLogs: string[] = []
  let verifyCalls = 0

  const dependencies: SetWalletHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findUserById: async (id: number) => {
      if (id !== 1001) return null
      return toResolvedUser(user)
    },
    findUserByWallet: async () => null,
    verifyProof: () => {
      verifyCalls += 1
      return { ok: true, boundAddress: 'EQ_BOUNCEABLE_ADDRESS' } satisfies VerifyResult
    },
    getExpectedDomain: () => 'cubeworlds.club',
    logError: (message) => {
      unhandledErrorLogs.push(message)
    },
    ...overrides,
  }

  const app = fastify()
  await app.register(buildSetWalletHandler(dependencies), {
    prefix: '/api/auth',
  })

  const ctx: SetWalletTestContext = {
    app,
    user,
    unhandledErrorLogs,
    get verifyCalls() {
      return verifyCalls
    },
  } as SetWalletTestContext
  Object.defineProperty(ctx, 'verifyCalls', { get: () => verifyCalls })
  return ctx
}

test('POST /api/auth/set-wallet validates required fields', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const missingInitData = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { ...VALID_PROOF_BODY, initData: '' },
  })
  assert.equal(missingInitData.json().error, 'No initData provided')

  const missingAddress = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { ...VALID_PROOF_BODY, address: '' },
  })
  assert.equal(missingAddress.json().error, 'No wallet provided')
})

test('POST /api/auth/set-wallet rejects bodies missing proof fields', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const missingProof = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      address: 'EQ_x',
      publicKey: 'ab'.repeat(32),
      walletStateInit: 'base64',
    },
  })
  assert.equal(missingProof.json().error, 'Wallet proof required')
  assert.equal(ctx.verifyCalls, 0)
})

test('POST /api/auth/set-wallet returns user not found', async (t) => {
  const ctx = await createSetWalletTestContext({
    parseInitData: () => ({ user: { id: 404 } } as InitData),
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'User not found in database')
  assert.equal(ctx.verifyCalls, 0)
})

test('POST /api/auth/set-wallet rejects invalid wallet proof', async (t) => {
  const ctx = await createSetWalletTestContext({
    verifyProof: () => ({ ok: false, reason: 'signature_invalid' }),
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Wallet proof invalid')
  assert.equal(ctx.user.wallet, undefined)
  assert.equal(ctx.user.saveCalls, 0)
})

test('POST /api/auth/set-wallet rejects wallet linked to another user', async (t) => {
  const otherUser = createStubUser({ id: 2002, wallet: 'EQ_BOUNCEABLE_ADDRESS' })
  const ctx = await createSetWalletTestContext({
    findUserByWallet: async () => toResolvedUser(otherUser),
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(
    response.json().error,
    'Wallet already linked to another account',
  )
  assert.equal(ctx.user.wallet, undefined)
  assert.equal(ctx.user.saveCalls, 0)
})

test('POST /api/auth/set-wallet allows the same user to re-set their wallet', async (t) => {
  const ctx = await createSetWalletTestContext({
    findUserByWallet: async () =>
      toResolvedUser({
        id: 1001,
        wallet: 'EQ_BOUNCEABLE_ADDRESS',
        saveCalls: 0,
        save: async () => {},
      }),
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().wallet, 'EQ_BOUNCEABLE_ADDRESS')
})

test('POST /api/auth/set-wallet updates wallet and saves user', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.equal(body.id, 1001)
  assert.equal(body.wallet, 'EQ_BOUNCEABLE_ADDRESS')
  assert.equal(body.message, 'Wallet updated successfully')
  assert.equal(ctx.user.wallet, 'EQ_BOUNCEABLE_ADDRESS')
  assert.equal(ctx.user.saveCalls, 1)
  assert.equal(ctx.verifyCalls, 1)
})

test('default validateInitData refuses to run without BOT_TOKEN', async (t) => {
  const savedToken = process.env.BOT_TOKEN
  delete process.env.BOT_TOKEN
  const savedUrl = process.env.WEB_APP_URL
  process.env.WEB_APP_URL = 'https://cubeworlds.club'

  const app = fastify()
  await app.register(buildSetWalletHandler(), { prefix: '/api/auth' })
  t.after(async () => {
    await app.close()
    if (savedToken === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = savedToken
    if (savedUrl === undefined) delete process.env.WEB_APP_URL
    else process.env.WEB_APP_URL = savedUrl
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: VALID_PROOF_BODY,
  })

  assert.equal(response.statusCode, 200)
  // The raw 'BOT_TOKEN is not configured' message is sanitized so the
  // misconfiguration doesn't leak to the client.
  assert.equal(response.json().error, 'Unable to process request')
})

test('default validateInitData rejects unsigned initData via @telegram-apps validator', async (t) => {
  const savedToken = process.env.BOT_TOKEN
  process.env.BOT_TOKEN = 'test-bot-token-for-set-wallet-suite'
  const savedUrl = process.env.WEB_APP_URL
  process.env.WEB_APP_URL = 'https://cubeworlds.club'

  const app = fastify()
  await app.register(buildSetWalletHandler(), { prefix: '/api/auth' })
  t.after(async () => {
    await app.close()
    if (savedToken === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = savedToken
    if (savedUrl === undefined) delete process.env.WEB_APP_URL
    else process.env.WEB_APP_URL = savedUrl
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { ...VALID_PROOF_BODY, initData: 'not-a-real-signed-payload' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Unable to process request')
})

test('POST /api/auth/set-wallet rejects ill-typed wallet with validation error', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { ...VALID_PROOF_BODY, address: { not: 'a string' } },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid request body')
})

test('POST /api/auth/set-wallet rejects oversized wallet', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { ...VALID_PROOF_BODY, address: 'a'.repeat(129) },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid request body')
})

test('POST /api/auth/set-wallet rejects ill-shaped proof', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      ...VALID_PROOF_BODY,
      proof: { ...VALID_PROOF_BODY.proof, timestamp: 'not-a-number' },
    },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid request body')
})
