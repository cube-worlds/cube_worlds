/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCheckReferal } from '#root/bot/features/start'

interface UserStub {
  id: number
  wallet?: string
  referalId?: number
  saveCalls: number
  save: () => Promise<void>
}

function makeUser(overrides: Partial<UserStub> = {}): UserStub {
  const stub: UserStub = {
    id: 7,
    wallet: undefined,
    referalId: undefined,
    saveCalls: 0,
    save: async () => { stub.saveCalls += 1 },
    ...overrides,
  }
  return stub
}

interface CtxStub {
  match: string
  dbuser: UserStub
  t: (key: string) => string
  reply: (text: string) => Promise<unknown>
  replyCalls: string[]
}

function makeCtx(overrides: { match?: string, dbuser?: UserStub } = {}): CtxStub {
  const replyCalls: string[] = []
  return {
    match: overrides.match ?? '',
    dbuser: overrides.dbuser ?? makeUser(),
    t: (key) => `t(${key})`,
    reply: async (text) => { replyCalls.push(text) },
    replyCalls,
  }
}

test('checkReferal is a no-op when ctx.match is empty', async () => {
  const ctx = makeCtx({ match: '' })
  let findCalls = 0
  const checkReferal = buildCheckReferal({
    findUserById: async () => { findCalls += 1; return null },
  })

  await checkReferal(ctx as unknown as Context)

  assert.equal(findCalls, 0)
  assert.equal(ctx.replyCalls.length, 0)
  assert.equal(ctx.dbuser.saveCalls, 0)
})

test('checkReferal skips when the user already has a wallet', async () => {
  const ctx = makeCtx({ match: '42', dbuser: makeUser({ wallet: 'EQ...' }) })
  const checkReferal = buildCheckReferal({
    findUserById: async () => makeUser({ id: 42 }) as unknown as UserDoc,
  })

  await checkReferal(ctx as unknown as Context)
  assert.equal(ctx.dbuser.referalId, undefined)
  assert.equal(ctx.dbuser.saveCalls, 0)
})

test('checkReferal skips when the user already has a referalId set', async () => {
  const ctx = makeCtx({ match: '42', dbuser: makeUser({ referalId: 99 }) })
  const checkReferal = buildCheckReferal({
    findUserById: async () => makeUser({ id: 42 }) as unknown as UserDoc,
  })

  await checkReferal(ctx as unknown as Context)
  assert.equal(ctx.dbuser.referalId, 99)
  assert.equal(ctx.dbuser.saveCalls, 0)
})

test('checkReferal replies vote.no_receiver when the receiver does not exist', async () => {
  const ctx = makeCtx({ match: '42' })
  const checkReferal = buildCheckReferal({
    findUserById: async () => null,
  })

  await checkReferal(ctx as unknown as Context)

  assert.deepEqual(ctx.replyCalls, ['t(vote.no_receiver)'])
  assert.equal(ctx.dbuser.referalId, undefined)
})

test('checkReferal replies vote.self_vote when the receiver is the user themselves', async () => {
  const ctx = makeCtx({ match: '7', dbuser: makeUser({ id: 7 }) })
  const checkReferal = buildCheckReferal({
    findUserById: async () => makeUser({ id: 7 }) as unknown as UserDoc,
  })

  await checkReferal(ctx as unknown as Context)

  assert.deepEqual(ctx.replyCalls, ['t(vote.self_vote)'])
  assert.equal(ctx.dbuser.referalId, undefined)
})

test('checkReferal persists the referalId for a valid distinct receiver', async () => {
  const ctx = makeCtx({ match: '42', dbuser: makeUser({ id: 7 }) })
  const checkReferal = buildCheckReferal({
    findUserById: async () => makeUser({ id: 42 }) as unknown as UserDoc,
  })

  await checkReferal(ctx as unknown as Context)

  assert.equal(ctx.dbuser.referalId, 42)
  assert.equal(ctx.dbuser.saveCalls, 1)
  assert.equal(ctx.replyCalls.length, 0)
})
