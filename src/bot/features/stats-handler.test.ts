/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildStatsCommandHandler } from '#root/bot/features/stats-handler'

interface CtxStub {
  replyCalls: string[]
  reply: (text: string) => Promise<void>
}

function makeCtx(): CtxStub {
  const replyCalls: string[] = []
  return {
    replyCalls,
    reply: async (text) => { replyCalls.push(text) },
  }
}

test('stats handler renders all userStats fields in the reply', async () => {
  const ctx = makeCtx()
  const handler = buildStatsCommandHandler({
    userStats: async () => ({
      all: 100,
      notMinted: 60,
      minted: 40,
      month: 30,
      week: 15,
      day: 5,
    }),
  })

  await handler(ctx as unknown as Context)
  assert.equal(ctx.replyCalls.length, 1)
  const reply = ctx.replyCalls[0]
  assert.match(reply, /All: 100/)
  assert.match(reply, /With wallet: 60/)
  assert.match(reply, /NFT minted: 40/)
  assert.match(reply, /Active month: 30/)
  assert.match(reply, /Active week: 15/)
  assert.match(reply, /Active day: 5/)
})

test('stats handler awaits userStats before replying', async () => {
  const ctx = makeCtx()
  let resolveStats: (() => void) | null = null
  const statsPromise = new Promise<void>((r) => { resolveStats = r })
  const handler = buildStatsCommandHandler({
    userStats: async () => {
      await statsPromise
      return { all: 0, notMinted: 0, minted: 0, month: 0, week: 0, day: 0 }
    },
  })

  const done = handler(ctx as unknown as Context)
  assert.equal(ctx.replyCalls.length, 0)
  resolveStats!()
  await done
  assert.equal(ctx.replyCalls.length, 1)
})
