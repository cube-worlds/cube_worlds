/* eslint-disable test/no-import-node-test */
import type { AuthHandlerDependencies } from '#root/backend/auth-handler'
import type { InitData } from '@telegram-apps/init-data-node'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAuthHandler } from '#root/backend/auth-handler'
import fastify from 'fastify'

type ResolvedUser = NonNullable<
  Awaited<ReturnType<AuthHandlerDependencies['findUserById']>>
>

interface StubUser {
  id: number
  language: string
  wallet?: string
  referalId?: number
  votes: bigint
  saveCalls: number
  save: () => Promise<void>
}

interface AuthTestContext {
  app: ReturnType<typeof fastify>
  users: Map<number, StubUser>
  infoLogs: string[]
  errorLogs: string[]
}

function toResolvedUser(user: StubUser): ResolvedUser {
  return user as unknown as ResolvedUser
}

function createStubUser(overrides: Partial<StubUser> = {}): StubUser {
  const user: StubUser = {
    id: 1001,
    language: 'en',
    votes: BigInt(200),
    saveCalls: 0,
    save: async () => {
      user.saveCalls += 1
    },
    ...overrides,
  }
  return user
}

async function createAuthTestContext(
  overrides: Partial<AuthHandlerDependencies> = {},
): Promise<AuthTestContext> {
  const users = new Map<number, StubUser>([
    [1001, createStubUser()],
    [2002, createStubUser({ id: 2002, votes: BigInt(999) })],
  ])
  const infoLogs: string[] = []
  const errorLogs: string[] = []

  const dependencies: AuthHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findUserById: async (id: number) => {
      const user = users.get(id)
      return user ? toResolvedUser(user) : null
    },
    info: (message: string) => {
      infoLogs.push(message)
    },
    error: (message: string) => {
      errorLogs.push(message)
    },
    ...overrides,
  }

  const app = fastify()
  await app.register(buildAuthHandler(dependencies), { prefix: '/api/auth' })

  return {
    app,
    users,
    infoLogs,
    errorLogs,
  }
}

test('POST /api/auth/login validates required initData', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {},
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'No initData or hash provided')
})

test('POST /api/auth/login returns user not found', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () => ({ user: { id: 404 } } as InitData),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'User not found')
})

test('POST /api/auth/login returns validation error for missing telegram user id', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () => ({ user: {} } as InitData),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid telegram user id')
})

test('POST /api/auth/login assigns referral when eligible', async (t) => {
  const mainUser = createStubUser({ id: 1001, referalId: undefined, wallet: undefined })
  const receiver = createStubUser({ id: 7777 })

  const users = new Map<number, StubUser>([
    [1001, mainUser],
    [7777, receiver],
  ])

  const ctx = await createAuthTestContext({
    findUserById: async (id: number) => {
      const user = users.get(id)
      return user ? toResolvedUser(user) : null
    },
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      initData: 'signed-payload',
      referId: '7777',
    },
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.equal(body.id, 1001)
  assert.equal(body.referalId, 7777)
  assert.equal(mainUser.referalId, 7777)
  assert.equal(mainUser.saveCalls, 1)
  assert.deepEqual(ctx.infoLogs, ['Referrer added successfully'])
  assert.equal(body.balance, '200')
  assert.equal(typeof body.ip, 'string')
})
