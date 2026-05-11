/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { BalanceRecord } from '#root/bot/features/balance-handler'
import type { UserDoc } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildBalanceCommandHandler } from '#root/bot/features/balance-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

interface ReplyCall { text: string, options?: { parse_mode?: string } }
interface CtxStub {
  match: string
  dbuser: { id: number, name?: string }
  replyCalls: ReplyCall[]
  reply: (text: string, options?: { parse_mode?: string }) => Promise<void>
}

function makeCtx(match: string, dbuser: { id: number, name?: string }): CtxStub {
  const replyCalls: ReplyCall[] = []
  return {
    match,
    dbuser,
    replyCalls,
    reply: async (text, options) => { replyCalls.push({ text, options }) },
  }
}

test('balance handler queries own records when no argument is provided', async () => {
  const ctx = makeCtx('', { id: 7, name: 'alice' })
  const getCalls: Array<{ userId: number, count: number }> = []
  const records: BalanceRecord[] = [
    { amount: 100n, type: BalanceChangeType.Claim, createdAt: new Date(0) },
  ]
  const handler = buildBalanceCommandHandler({
    isAdmin: () => true, // even if admin, no argument means own records
    findUserByName: async () => { throw new Error('should not be called') },
    countAllBalanceRecords: async () => 42,
    getUserBalanceRecords: async (userId, count) => {
      getCalls.push({ userId, count })
      return records
    },
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(getCalls, [{ userId: 7, count: 42 }])
  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].options?.parse_mode, 'Markdown')
  assert.match(ctx.replyCalls[0].text, /@alice's balance/)
})

test('balance handler looks up another user when argument is provided AND ctx is admin', async () => {
  const ctx = makeCtx('@bob extra junk', { id: 1, name: 'alice' })
  const otherUser = { id: 99, name: 'bob' } as unknown as UserDoc
  let findCalls = 0
  const handler = buildBalanceCommandHandler({
    isAdmin: () => true,
    findUserByName: async (name) => {
      findCalls += 1
      assert.equal(name, 'bob') // stripped @ and split on space
      return otherUser
    },
    countAllBalanceRecords: async () => 5,
    getUserBalanceRecords: async (userId) => {
      assert.equal(userId, 99) // resolved to the looked-up user
      return []
    },
  })

  await handler(ctx as unknown as Context)
  assert.equal(findCalls, 1)
  assert.match(ctx.replyCalls[0].text, /@bob's balance/)
})

test('balance handler ignores argument when ctx is NOT admin', async () => {
  const ctx = makeCtx('@bob', { id: 1, name: 'alice' })
  let findCalls = 0
  const handler = buildBalanceCommandHandler({
    isAdmin: () => false,
    findUserByName: async () => { findCalls += 1; return null },
    countAllBalanceRecords: async () => 0,
    getUserBalanceRecords: async (userId) => {
      assert.equal(userId, 1) // stays as self
      return []
    },
  })

  await handler(ctx as unknown as Context)
  assert.equal(findCalls, 0) // no admin → no lookup
  assert.match(ctx.replyCalls[0].text, /@alice's balance/)
})

test('balance handler falls back to self when admin lookup misses', async () => {
  const ctx = makeCtx('@ghost', { id: 1, name: 'alice' })
  const handler = buildBalanceCommandHandler({
    isAdmin: () => true,
    findUserByName: async () => null, // not found
    countAllBalanceRecords: async () => 0,
    getUserBalanceRecords: async (userId) => {
      assert.equal(userId, 1) // falls back to self id
      return []
    },
  })

  await handler(ctx as unknown as Context)
  assert.match(ctx.replyCalls[0].text, /@alice's balance/)
})

test('balance handler renders one body row per record (kFormatter + type name + date)', async () => {
  const ctx = makeCtx('', { id: 7, name: 'alice' })
  const records: BalanceRecord[] = [
    { amount: 1500n, type: BalanceChangeType.Claim, createdAt: new Date('2026-05-11T10:00:00Z') },
    { amount: 250n, type: BalanceChangeType.Dice }, // no createdAt
  ]
  const handler = buildBalanceCommandHandler({
    isAdmin: () => false,
    findUserByName: async () => null,
    countAllBalanceRecords: async () => 2,
    getUserBalanceRecords: async () => records,
  })

  await handler(ctx as unknown as Context)
  const text = ctx.replyCalls[0].text
  assert.match(text, /Claim/)
  assert.match(text, /Dice/)
})
