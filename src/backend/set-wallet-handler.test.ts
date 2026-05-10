/* eslint-disable test/no-import-node-test */
import type { SetWalletHandlerDependencies } from '#root/backend/set-wallet-handler'
import type { InitData } from '@telegram-apps/init-data-node'
import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'
import { buildSetWalletHandler } from '#root/backend/set-wallet-handler'
import fastify from 'fastify'

type ResolvedUser = NonNullable<
  Awaited<ReturnType<SetWalletHandlerDependencies['findUserById']>>
>

type ParsedAddress = ReturnType<SetWalletHandlerDependencies['parseWalletAddress']>

interface StubUser {
  id: number
  wallet?: string
  saveCalls: number
  save: () => Promise<void>
}

interface SetWalletTestContext {
  app: ReturnType<typeof fastify>
  user: StubUser
}

function toResolvedUser(user: StubUser): ResolvedUser {
  return user as unknown as ResolvedUser
}

function createParsedAddress(value: string): ParsedAddress {
  return {
    toString: () => value,
  } as unknown as ParsedAddress
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

async function createSetWalletTestContext(
  overrides: Partial<SetWalletHandlerDependencies> = {},
): Promise<SetWalletTestContext> {
  const user = createStubUser()

  const dependencies: SetWalletHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findUserById: async (id: number) => {
      if (id !== 1001) return null
      return toResolvedUser(user)
    },
    findUserByWallet: async () => null,
    parseWalletAddress: (wallet: string) => createParsedAddress(wallet),
    ...overrides,
  }

  const app = fastify()
  await app.register(buildSetWalletHandler(dependencies), {
    prefix: '/api/auth',
  })

  return { app, user }
}

test('POST /api/auth/set-wallet validates required fields', async (t) => {
  const ctx = await createSetWalletTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const missingInitData = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { wallet: 'EQ_1' },
  })
  assert.equal(missingInitData.json().error, 'No initData provided')

  const missingWallet = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { initData: 'signed' },
  })
  assert.equal(missingWallet.json().error, 'No wallet provided')
})

test('POST /api/auth/set-wallet returns user not found', async (t) => {
  const ctx = await createSetWalletTestContext({
    parseInitData: () => ({ user: { id: 404 } } as InitData),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      wallet: 'EQ_1',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'User not found in database')
})

test('POST /api/auth/set-wallet validates wallet format', async (t) => {
  const ctx = await createSetWalletTestContext({
    parseWalletAddress: () => {
      throw new Error('invalid address')
    },
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      wallet: 'not_an_address',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid wallet address')
})

test('POST /api/auth/set-wallet rejects wallet linked to another user', async (t) => {
  const otherUser = createStubUser({ id: 2002, wallet: 'EQ_BOUNCEABLE_ADDRESS' })
  const ctx = await createSetWalletTestContext({
    parseWalletAddress: () => createParsedAddress('EQ_BOUNCEABLE_ADDRESS'),
    findUserByWallet: async () => toResolvedUser(otherUser),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      wallet: 'EQ_BOUNCEABLE_ADDRESS',
    },
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
    parseWalletAddress: () => createParsedAddress('EQ_BOUNCEABLE_ADDRESS'),
    findUserByWallet: async () =>
      toResolvedUser({
        id: 1001,
        wallet: 'EQ_BOUNCEABLE_ADDRESS',
        saveCalls: 0,
        save: async () => {},
      }),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      wallet: 'EQ_BOUNCEABLE_ADDRESS',
    },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().wallet, 'EQ_BOUNCEABLE_ADDRESS')
})

test('POST /api/auth/set-wallet updates wallet and saves user', async (t) => {
  const ctx = await createSetWalletTestContext({
    parseWalletAddress: () => createParsedAddress('EQ_BOUNCEABLE_ADDRESS'),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: {
      initData: 'signed',
      wallet: 'UQ_NON_BOUNCEABLE_ADDRESS',
    },
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.equal(body.id, 1001)
  assert.equal(body.wallet, 'EQ_BOUNCEABLE_ADDRESS')
  assert.equal(body.message, 'Wallet updated successfully')
  assert.equal(ctx.user.wallet, 'EQ_BOUNCEABLE_ADDRESS')
  assert.equal(ctx.user.saveCalls, 1)
})

// Cover the default dependency factory: the production validateInitData
// closure reads BOT_TOKEN and forwards to @telegram-apps/init-data-node.

test('default validateInitData refuses to run without BOT_TOKEN', async (t) => {
  const savedToken = process.env.BOT_TOKEN
  delete process.env.BOT_TOKEN

  const app = fastify()
  await app.register(buildSetWalletHandler(), { prefix: '/api/auth' })
  t.after(async () => {
    await app.close()
    if (savedToken === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = savedToken
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { initData: 'anything', wallet: 'EQ_x' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'BOT_TOKEN is not configured')
})

test('default validateInitData rejects unsigned initData via @telegram-apps validator', async (t) => {
  const savedToken = process.env.BOT_TOKEN
  process.env.BOT_TOKEN = 'test-bot-token-for-set-wallet-suite'

  const app = fastify()
  await app.register(buildSetWalletHandler(), { prefix: '/api/auth' })
  t.after(async () => {
    await app.close()
    if (savedToken === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = savedToken
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/set-wallet',
    payload: { initData: 'not-a-real-signed-payload', wallet: 'EQ_x' },
  })

  // The validator throws → caught and surfaced as { error }. We don't
  // assert on the exact message (it's owned by the upstream library), only
  // that we hit the catch branch with a non-empty error string.
  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(typeof body.error, 'string')
  assert.notEqual(body.error, '')
  assert.notEqual(body.error, 'BOT_TOKEN is not configured')
})
