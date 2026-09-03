/* eslint-disable test/no-import-node-test */
import type { TopupPaymentDependencies } from '#root/bot/features/topup-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTopupPaymentHandler,
  parseTopupPayload,
} from '#root/bot/features/topup-handler'

// parseTopupPayload

test('parseTopupPayload round-trips a well-formed payload', () => {
  assert.deepEqual(parseTopupPayload('cube-topup:1001:250:2500'), {
    userId: 1001,
    stars: 250,
    votes: 2500n,
  })
})

test('parseTopupPayload rejects malformed payloads', () => {
  assert.equal(parseTopupPayload(''), null)
  assert.equal(parseTopupPayload('season-pass:1001'), null)
  assert.equal(parseTopupPayload('cube-topup:1001:250'), null, 'missing votes')
  assert.equal(parseTopupPayload('cube-topup:abc:250:2500'), null)
  assert.equal(parseTopupPayload('cube-topup:1001:0:0'), null, 'zero amounts')
  assert.equal(parseTopupPayload('cube-topup:1001:250:x'), null)
  assert.equal(parseTopupPayload('cube-topup:-5:250:2500'), null)
})

// buildTopupPaymentHandler

interface TopupTestContext {
  handle: ReturnType<typeof buildTopupPaymentHandler>
  recordCalls: Array<{ chargeId: string, userId: number, votes: bigint }>
  creditCalls: Array<{ userId: number, votes: bigint }>
  notifyCalls: number[]
  errors: string[]
}

function createContext(
  overrides: Partial<TopupPaymentDependencies> = {},
): TopupTestContext {
  const recordCalls: TopupTestContext['recordCalls'] = []
  const creditCalls: TopupTestContext['creditCalls'] = []
  const notifyCalls: number[] = []
  const errors: string[] = []
  const handle = buildTopupPaymentHandler({
    record: async (chargeId, userId, _stars, votes) => {
      recordCalls.push({ chargeId, userId, votes })
      return true
    },
    credit: async (userId, votes) => {
      creditCalls.push({ userId, votes })
    },
    notifyUser: async (userId) => {
      notifyCalls.push(userId)
    },
    logError: (message) => {
      errors.push(message)
    },
    ...overrides,
  })
  return { handle, recordCalls, creditCalls, notifyCalls, errors }
}

test('a fresh charge records, credits, and notifies', async () => {
  const ctx = createContext()
  const result = await ctx.handle('cube-topup:1001:250:2500', 'charge-1')

  assert.deepEqual(result, { ok: true, userId: 1001, votes: 2500n })
  assert.deepEqual(ctx.recordCalls, [
    { chargeId: 'charge-1', userId: 1001, votes: 2500n },
  ])
  assert.deepEqual(ctx.creditCalls, [{ userId: 1001, votes: 2500n }])
  assert.deepEqual(ctx.notifyCalls, [1001])
})

test('a replayed charge is a no-op (no double credit)', async () => {
  const ctx = createContext({ record: async () => false })
  const result = await ctx.handle('cube-topup:1001:250:2500', 'charge-1')

  assert.deepEqual(result, { ok: false, reason: 'duplicate' })
  assert.equal(ctx.creditCalls.length, 0, 'duplicate never credits')
  assert.equal(ctx.notifyCalls.length, 0)
})

test('a bad payload never touches the ledger', async () => {
  const ctx = createContext()
  const result = await ctx.handle('garbage', 'charge-1')

  assert.deepEqual(result, { ok: false, reason: 'bad-payload' })
  assert.equal(ctx.recordCalls.length, 0)
  assert.equal(ctx.creditCalls.length, 0)
})

test('a credit failure is reported loudly and never notifies', async () => {
  const ctx = createContext({
    credit: async () => {
      throw new Error('mongo down')
    },
  })
  const result = await ctx.handle('cube-topup:1001:250:2500', 'charge-1')

  assert.deepEqual(result, { ok: false, reason: 'credit-failed' })
  assert.equal(ctx.notifyCalls.length, 0)
  assert.equal(ctx.errors.length, 1)
  assert.match(ctx.errors[0], /charge-1/)
})

test('a notify failure does not fail the top-up', async () => {
  const ctx = createContext({
    notifyUser: async () => {
      throw new Error('blocked the bot')
    },
  })
  const result = await ctx.handle('cube-topup:1001:250:2500', 'charge-1')

  assert.equal(result.ok, true)
  assert.deepEqual(ctx.creditCalls, [{ userId: 1001, votes: 2500n }])
})
