/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildResetCommandHandler } from '#root/bot/features/reset-handler'
import { UserState } from '#root/common/models/User'

interface DbuserStub {
  state: UserState
  votes: bigint
  saveCalls: number
  save: () => Promise<void>
}

interface CtxStub {
  dbuser: DbuserStub
  replyCalls: string[]
  reply: (text: string) => Promise<void>
  t: (key: string) => string
}

function makeCtx(initial: Partial<DbuserStub> = {}): CtxStub {
  const dbuser: DbuserStub = {
    state: UserState.Submited,
    votes: 0n,
    saveCalls: 0,
    save: async () => { dbuser.saveCalls += 1 },
    ...initial,
  }
  const replyCalls: string[] = []
  return {
    dbuser,
    replyCalls,
    reply: async (text) => { replyCalls.push(text) },
    t: (key) => `t(${key})`,
  }
}

test('reset handler resets the user state to WaitNothing and saves', async () => {
  const ctx = makeCtx({ state: UserState.Submited })
  const handler = buildResetCommandHandler({ voteScore: async () => 100 })
  await handler(ctx as unknown as Context)
  assert.equal(ctx.dbuser.state, UserState.WaitNothing)
  assert.equal(ctx.dbuser.saveCalls, 1)
})

test('reset handler defaults votes from voteScore when votes is 0n', async () => {
  const ctx = makeCtx({ votes: 0n })
  let voteScoreCalls = 0
  const handler = buildResetCommandHandler({
    voteScore: async () => { voteScoreCalls += 1; return 1000 },
  })
  await handler(ctx as unknown as Context)
  assert.equal(voteScoreCalls, 1)
  assert.equal(ctx.dbuser.votes, 1000n)
})

test('reset handler leaves existing votes untouched and skips voteScore', async () => {
  const ctx = makeCtx({ votes: 42n })
  let voteScoreCalls = 0
  const handler = buildResetCommandHandler({
    voteScore: async () => { voteScoreCalls += 1; return 1000 },
  })
  await handler(ctx as unknown as Context)
  assert.equal(voteScoreCalls, 0)
  assert.equal(ctx.dbuser.votes, 42n)
})

test('reset handler replies with the translated reset key', async () => {
  const ctx = makeCtx()
  const handler = buildResetCommandHandler({ voteScore: async () => 100 })
  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['t(reset)'])
})
