/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { AuthHandlerDependencies } from '#root/backend/auth-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildAuthHandler } from '#root/backend/auth-handler'

type ResolvedUser = NonNullable<
  Awaited<ReturnType<AuthHandlerDependencies['findUserById']>>
>

interface StubUser {
  id: number
  language: string
  name?: string
  wallet?: string
  referalId?: number
  votes: bigint
  minted: boolean
  state: string
  pass?: { index: number, address: string, name: string, image: string, verifiedAt: Date }
  saveCalls: number
  save: () => Promise<void>
}

interface AuthTestContext {
  app: ReturnType<typeof fastify>
  users: Map<number, StubUser>
  infoLogs: string[]
  errorLogs: string[]
  unhandledErrorLogs: string[]
  listCalls: string[]
  setPassCalls: Array<{ userId: number, index: number, verifiedAt: Date }>
  clearPassCalls: number[]
}

function toResolvedUser(user: StubUser): ResolvedUser {
  return user as unknown as ResolvedUser
}

function createStubUser(overrides: Partial<StubUser> = {}): StubUser {
  const user: StubUser = {
    id: 1001,
    language: 'en',
    votes: BigInt(200),
    minted: false,
    state: 'WaitNothing',
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
  const unhandledErrorLogs: string[] = []
  const listCalls: string[] = []
  const setPassCalls: Array<{ userId: number, index: number, verifiedAt: Date }> = []
  const clearPassCalls: number[] = []

  const dependencies: AuthHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001, username: 'alice' } } as InitData),
    findUserById: async (id: number) => {
      const user = users.get(id)
      return user ? toResolvedUser(user) : null
    },
    findOrCreateUser: async (id: number) => {
      // Upsert: create-and-insert a fresh stub if the user is unknown.
      let user = users.get(id)
      if (!user) {
        user = createStubUser({ id, votes: BigInt(0) })
        users.set(id, user)
      }
      return toResolvedUser(user)
    },
    info: (message: string) => {
      infoLogs.push(message)
    },
    error: (message: string) => {
      errorLogs.push(message)
    },
    logError: (message: string) => {
      unhandledErrorLogs.push(message)
    },
    listPasses: async (owner: string) => {
      listCalls.push(owner)
      return [{ index: 7, address: 'EQ_A', name: 'alice', image: '' }]
    },
    setUserPass: async (userId, pass, verifiedAt) => {
      setPassCalls.push({ userId, index: pass.index, verifiedAt })
    },
    clearUserPass: async (userId) => {
      clearPassCalls.push(userId)
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
    unhandledErrorLogs,
    listCalls,
    setPassCalls,
    clearPassCalls,
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

test('POST /api/auth/login upserts a brand-new user (no "User not found")', async (t) => {
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

  const body = response.json()
  assert.equal(response.statusCode, 200)
  assert.equal(body.error, undefined, 'no error — the user is created on first login')
  assert.equal(body.id, 404)
  // freshly created → not minted, default mint state
  assert.equal(body.minted, false)
  assert.equal(body.mintState, 'WaitNothing')
  // the upsert actually inserted the user
  assert.ok(ctx.users.has(404), 'new user persisted')
})

test('POST /api/auth/login returns minted + mintState for an existing user', async (t) => {
  const ctx = await createAuthTestContext()
  ctx.users.get(1001)!.minted = true
  ctx.users.get(1001)!.state = 'Submited'
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload' },
  })

  const body = response.json()
  assert.equal(body.id, 1001)
  assert.equal(body.minted, true)
  assert.equal(body.mintState, 'Submited')
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

test('POST /api/auth/login sanitizes unexpected catch-branch errors', async (t) => {
  const ctx = await createAuthTestContext({
    validateInitData: () => {
      throw new Error('Invalid initData signature')
    },
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'tampered' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Unable to process request')
  assert.equal(ctx.unhandledErrorLogs.length, 1)
  assert.match(ctx.unhandledErrorLogs[0], /Invalid initData signature/)
})

test('POST /api/auth/login logs referral error when referrer is the same user', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload', referId: '1001' },
  })

  const body = response.json()
  assert.equal(body.id, 1001)
  // referrer was self → not assigned, error logged
  assert.equal(body.referalId, undefined)
  assert.deepEqual(ctx.errorLogs, ['Referrer not found or same as user'])
  assert.deepEqual(ctx.infoLogs, [])
})

test('POST /api/auth/login logs referral error when referrer does not exist', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload', referId: '99999' },
  })

  assert.equal(response.json().referalId, undefined)
  assert.deepEqual(ctx.errorLogs, ['Referrer not found or same as user'])
})

test('POST /api/auth/login skips referral when user already has a wallet', async (t) => {
  const ctx = await createAuthTestContext()
  ctx.users.get(1001)!.wallet = 'EQAlreadyOnboarded'
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed-payload', referId: '2002' },
  })

  assert.equal(response.json().referalId, undefined)
  // No referral path taken at all → neither info nor error logged
  assert.deepEqual(ctx.infoLogs, [])
  assert.deepEqual(ctx.errorLogs, [])
})

test('POST /api/auth/login assigns referral when eligible', async (t) => {
  // Name already matches the default stub `parseInitData` username so the
  // name-sync path doesn't add an extra save() beyond the referral one.
  const mainUser = createStubUser({ id: 1001, name: 'alice', referalId: undefined, wallet: undefined })
  const receiver = createStubUser({ id: 7777 })

  const users = new Map<number, StubUser>([
    [1001, mainUser],
    [7777, receiver],
  ])

  const lookup = async (id: number) => {
    const user = users.get(id)
    return user ? toResolvedUser(user) : null
  }
  const ctx = await createAuthTestContext({
    findUserById: lookup,
    findOrCreateUser: lookup,
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

test('POST /api/auth/login rejects ill-typed initData with validation error', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: { not: 'a string' } },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid request body')
})

test('POST /api/auth/login rejects oversized initData', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'a'.repeat(8193) },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Invalid request body')
})

// name sync — webview users have no other code path that sets `name`

test('POST /api/auth/login syncs the Telegram username into user.name', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () =>
      ({ user: { id: 1001, username: 'alice', first_name: 'Alice' } } as InitData),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed' },
  })

  const user = ctx.users.get(1001)!
  assert.equal(user.name, 'alice')
  assert.equal(user.saveCalls, 1, 'saved once for the name sync')
})

test('POST /api/auth/login falls back to first_name when there is no username', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () =>
      ({ user: { id: 1001, first_name: 'Alice' } } as InitData),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed' },
  })

  assert.equal(ctx.users.get(1001)!.name, 'Alice')
})

test('POST /api/auth/login does not save when the name is already current', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () =>
      ({ user: { id: 1001, username: 'alice' } } as InitData),
  })
  ctx.users.get(1001)!.name = 'alice'
  t.after(async () => {
    await ctx.app.close()
  })

  await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { initData: 'signed' },
  })

  assert.equal(ctx.users.get(1001)!.saveCalls, 0, 'no redundant save')
})

const HOUR = 60 * 60 * 1000
const FRESH_PASS = { index: 7, address: 'EQ_A', name: 'alice', image: '', verifiedAt: new Date() }
const STALE_PASS = { ...FRESH_PASS, verifiedAt: new Date(Date.now() - 2 * HOUR) }

test('login returns holder=false, pass=null and the Telegram username for a newcomer', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.holder, false)
  assert.equal(body.pass, null)
  assert.equal(body.username, 'alice')
  assert.deepEqual(ctx.listCalls, [])
})

test('login returns username=null when Telegram has no @username', async (t) => {
  const ctx = await createAuthTestContext({
    parseInitData: () => ({ user: { id: 1001, first_name: 'Ann' } } as InitData),
  })
  t.after(() => ctx.app.close())
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  assert.equal(res.json().username, null)
})

test('login with a fresh pass is a holder and does not touch the chain', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(() => ctx.app.close())
  ctx.users.get(1001)!.wallet = 'EQ_WALLET'
  ctx.users.get(1001)!.pass = FRESH_PASS
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.holder, true)
  assert.equal(body.pass.index, 7)
  assert.deepEqual(ctx.listCalls, [])
})

test('login with a stale pass still owned bumps verifiedAt', async (t) => {
  const ctx = await createAuthTestContext()
  t.after(() => ctx.app.close())
  ctx.users.get(1001)!.wallet = 'EQ_WALLET'
  ctx.users.get(1001)!.pass = STALE_PASS
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  assert.equal(res.json().holder, true)
  assert.deepEqual(ctx.listCalls, ['EQ_WALLET'])
  assert.equal(ctx.setPassCalls.length, 1)
  assert.equal(ctx.setPassCalls[0].index, 7)
  assert.ok(ctx.setPassCalls[0].verifiedAt.getTime() > STALE_PASS.verifiedAt.getTime())
  assert.deepEqual(ctx.clearPassCalls, [])
})

test('login with a stale pass that left the wallet clears it', async (t) => {
  const ctx = await createAuthTestContext({ listPasses: async () => [] })
  t.after(() => ctx.app.close())
  ctx.users.get(1001)!.wallet = 'EQ_WALLET'
  ctx.users.get(1001)!.pass = STALE_PASS
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.holder, false)
  assert.equal(body.pass, null)
  assert.deepEqual(ctx.clearPassCalls, [1001])
})

test('login keeps a stale pass when the provider fails', async (t) => {
  const ctx = await createAuthTestContext({
    listPasses: async () => { throw new Error('toncenter down') },
  })
  t.after(() => ctx.app.close())
  ctx.users.get(1001)!.wallet = 'EQ_WALLET'
  ctx.users.get(1001)!.pass = STALE_PASS
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { initData: 'x' } })
  assert.equal(res.json().holder, true)
  assert.deepEqual(ctx.clearPassCalls, [])
  assert.ok(ctx.errorLogs.some((m) => /toncenter down/.test(m)))
})
