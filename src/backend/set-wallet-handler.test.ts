/* eslint-disable test/no-import-node-test */
import type { SetWalletHandlerDependencies } from '#root/backend/set-wallet-handler'
import type { InitData } from '@telegram-apps/init-data-node'
import assert from 'node:assert/strict'
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
