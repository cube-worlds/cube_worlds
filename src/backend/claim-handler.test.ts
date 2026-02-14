/* eslint-disable test/no-import-node-test */
import type { ClaimHandlerDependencies } from '#root/backend/claim-handler'
import type { InitData } from '@telegram-apps/init-data-node'
import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { buildClaimHandler } from '#root/backend/claim-handler'
import { BalanceChangeType } from '#root/common/models/Balance'
import fastify from 'fastify'

type ResolvedUser = NonNullable<
  Awaited<ReturnType<ClaimHandlerDependencies['findUserById']>>
>
type ResolvedClaim = Awaited<
  ReturnType<ClaimHandlerDependencies['findOrCreateClaim']>
>

interface TestContext {
  app: ReturnType<typeof fastify>
  user: {
    id: number
    votes: bigint
  }
  addPointsCalls: Array<{
    userId: number
    amount: bigint
    reason: BalanceChangeType
  }>
}

async function createTestContext(
  overrides: Partial<ClaimHandlerDependencies> = {},
): Promise<TestContext> {
  const user = {
    id: 1001,
    votes: BigInt(500),
  }
  const claim = {}
  const addPointsCalls: TestContext['addPointsCalls'] = []

  const dependencies: ClaimHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () =>
      ({
        user: { id: user.id },
      }) as InitData,
    findUserById: async (id: number) =>
      id === user.id ? (user as ResolvedUser) : null,
    findOrCreateClaim: async () => claim as ResolvedClaim,
    getClaimStatus: () =>
      ({
        canClaim: true,
        secondsUntilClaim: 0,
      }) as ReturnType<ClaimHandlerDependencies['getClaimStatus']>,
    claimDaily: async () => ({
      claimedAmount: 10,
      rawClaimAmount: 10,
      streakDays: 1,
    }),
    addPoints: async (userId, amount, reason) => {
      addPointsCalls.push({ userId, amount, reason })
      user.votes += amount
      return user.votes
    },
    ...overrides,
  }

  const app = fastify()
  await app.register(buildClaimHandler(dependencies), { prefix: '/api/users' })

  return { app, user, addPointsCalls }
}

test('POST /api/users/claim returns validation error for empty initData', async (t) => {
  const ctx = await createTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/claim',
    payload: {},
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.equal(body.error, 'No initData provided')
})

test('POST /api/users/claim/status returns user claim status', async (t) => {
  const ctx = await createTestContext({
    getClaimStatus: () =>
      ({
        canClaim: false,
        secondsUntilClaim: 17,
        claimMultiplier: 2,
      }) as ReturnType<ClaimHandlerDependencies['getClaimStatus']>,
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/claim/status',
    payload: { initData: 'signed-telegram-payload' },
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.equal(body.id, 1001)
  assert.equal(body.canClaim, false)
  assert.equal(body.secondsUntilClaim, 17)
  assert.equal(body.claimMultiplier, 2)
})

test('POST /api/users/claim applies reward and records claim reason', async (t) => {
  const ctx = await createTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/claim',
    payload: { initData: 'signed-telegram-payload' },
  })
  const body = response.json()

  assert.equal(body.id, 1001)
  assert.equal(body.claimedAmount, 10)
  assert.equal(body.rawClaimAmount, 10)
  assert.equal(body.balance, '510')
  assert.equal(ctx.addPointsCalls.length, 1)
  assert.deepEqual(ctx.addPointsCalls[0], {
    userId: 1001,
    amount: BigInt(10),
    reason: BalanceChangeType.Claim,
  })
})

test('POST /api/users/claim does not add points when claimed amount is zero', async (t) => {
  const ctx = await createTestContext({
    claimDaily: async () => ({
      claimedAmount: 0,
      rawClaimAmount: 0,
      streakDays: 1,
    }),
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/claim',
    payload: { initData: 'signed-telegram-payload' },
  })
  const body = response.json()

  assert.equal(body.claimedAmount, 0)
  assert.equal(body.balance, '500')
  assert.equal(ctx.addPointsCalls.length, 0)
})

test('POST /api/users/claim blocks concurrent double claim attempts for same user', async (t) => {
  let claimAvailable = true
  const ctx = await createTestContext({
    claimDaily: async () => {
      if (!claimAvailable) {
        throw new Error('Claim is not available yet')
      }
      await delay(30)
      claimAvailable = false
      return {
        claimedAmount: 100,
        rawClaimAmount: 100,
        streakDays: 1,
      }
    },
  })
  t.after(async () => {
    await ctx.app.close()
  })

  const [first, second] = await Promise.all([
    ctx.app.inject({
      method: 'POST',
      url: '/api/users/claim',
      payload: { initData: 'signed-telegram-payload' },
    }),
    ctx.app.inject({
      method: 'POST',
      url: '/api/users/claim',
      payload: { initData: 'signed-telegram-payload' },
    }),
  ])

  const payloads = [first.json(), second.json()]
  const successCount = payloads.filter(
    (payload) => payload.claimedAmount === 100,
  ).length
  const blockedCount = payloads.filter(
    (payload) => payload.error === 'Claim is not available yet',
  ).length

  const payloadsDebug = JSON.stringify(payloads)
  assert.equal(successCount, 1, payloadsDebug)
  assert.equal(blockedCount, 1, payloadsDebug)
  assert.equal(ctx.addPointsCalls.length, 1)
  assert.equal(ctx.user.votes, BigInt(600))
})
