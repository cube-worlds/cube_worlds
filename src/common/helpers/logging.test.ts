/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { NextFunction } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getUpdateInfo, logHandle } from '#root/common/helpers/logging'

interface LogCall {
  msg: string
  update?: unknown
}

function makeCtx(update: Record<string, unknown>) {
  const calls: LogCall[] = []
  const ctx = {
    update,
    logger: { info: (entry: LogCall) => { calls.push(entry) } },
  } as unknown as Context
  return { ctx, calls }
}

test('getUpdateInfo strips update_id from the update payload', () => {
  const { ctx } = makeCtx({ update_id: 99, message: { text: 'hi' } })
  assert.deepEqual(getUpdateInfo(ctx), { message: { text: 'hi' } })
})

test('logHandle logs the handler id and calls next', async () => {
  const { ctx, calls } = makeCtx({ update_id: 1, message: { text: 'hi' } })
  let nextCalls = 0
  const next: NextFunction = async () => { nextCalls += 1 }

  await logHandle('command-foo')(ctx, next)

  assert.equal(nextCalls, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].msg, 'handle command-foo')
  // Non-unhandled ids omit the update payload
  assert.equal(calls[0].update, undefined)
})

test('logHandle includes stripped update info when id starts with "unhandled"', async () => {
  const { ctx, calls } = makeCtx({ update_id: 1, message: { text: 'hi' } })

  await logHandle('unhandled-message')(ctx, async () => {})

  assert.equal(calls.length, 1)
  assert.equal(calls[0].msg, 'handle unhandled-message')
  assert.deepEqual(calls[0].update, { message: { text: 'hi' } })
})
