/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCheckReferal, buildStartCommandHandler } from '#root/bot/features/start'

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

interface ReplyOptions {
  link_preview_options?: { is_disabled?: boolean }
  reply_markup?: unknown
}

interface CtxStub {
  match: string
  dbuser: UserStub
  t: (key: string) => string
  reply: (text: string, options?: ReplyOptions) => Promise<unknown>
  replyCalls: string[]
  replyOptions: Array<ReplyOptions | undefined>
}

function makeCtx(overrides: { match?: string, dbuser?: UserStub } = {}): CtxStub {
  const replyCalls: string[] = []
  const replyOptions: Array<ReplyOptions | undefined> = []
  return {
    match: overrides.match ?? '',
    dbuser: overrides.dbuser ?? makeUser(),
    t: (key) => `t(${key})`,
    reply: async (text, options) => {
      replyCalls.push(text)
      replyOptions.push(options)
    },
    replyCalls,
    replyOptions,
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

test('/start handler replies with t(start) and no inline keyboard', async () => {
  const ctx = makeCtx()
  const handler = buildStartCommandHandler({ checkReferal: async () => {} })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0], 't(start)')
  assert.equal(ctx.replyOptions[0]?.reply_markup, undefined)
})

test('/start handler invokes checkReferal after replying', async () => {
  const order: string[] = []
  const ctx = makeCtx()
  const trackedReply = ctx.reply
  ctx.reply = async (text, options) => {
    order.push('reply')
    return trackedReply(text, options)
  }
  const handler = buildStartCommandHandler({
    checkReferal: async () => { order.push('checkReferal') },
  })

  await handler(ctx as unknown as Context)

  assert.deepEqual(order, ['reply', 'checkReferal'])
})
