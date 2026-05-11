/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { NextFunction } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateLogger } from '#root/bot/middlewares/update-logger'

interface DebugCall {
  msg: string
  method?: string
  payload?: unknown
  duration?: number
  update?: unknown
}

type Transformer = (
  previous: (method: string, payload: unknown, signal: unknown) => unknown,
  method: string,
  payload: unknown,
  signal: unknown,
) => unknown

function makeContext(
  debugCalls: DebugCall[],
  transformerHolder: { fn?: Transformer },
) {
  return {
    api: {
      config: {
        use: (fn: Transformer) => {
          transformerHolder.fn = fn
        },
      },
    },
    logger: {
      debug: (entry: DebugCall) => { debugCalls.push(entry) },
    },
    update: { update_id: 1, message: { text: 'hello' } },
  }
}

test('updateLogger logs "update received" with stripped update info and calls next()', async () => {
  const calls: DebugCall[] = []
  const transformerHolder: { fn?: Transformer } = {}
  const ctx = makeContext(calls, transformerHolder) as unknown as Context

  let nextCalls = 0
  const next: NextFunction = async () => { nextCalls += 1 }
  await updateLogger()(ctx, next)

  assert.equal(nextCalls, 1)
  // First debug call is "update received", second is "update processed"
  assert.equal(calls.length, 2)
  assert.equal(calls[0].msg, 'update received')
  // getUpdateInfo strips update_id
  assert.deepEqual(calls[0].update, { message: { text: 'hello' } })
  assert.equal(calls[1].msg, 'update processed')
  assert.ok(typeof calls[1].duration === 'number')
  assert.ok(calls[1].duration! >= 0)
})

test('updateLogger logs "update processed" even when next() throws', async () => {
  const calls: DebugCall[] = []
  const transformerHolder: { fn?: Transformer } = {}
  const ctx = makeContext(calls, transformerHolder) as unknown as Context

  const next: NextFunction = async () => {
    throw new Error('handler-failed')
  }

  await assert.rejects(async () => updateLogger()(ctx, next), /handler-failed/)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].msg, 'update processed')
})

test('updateLogger registers an api transformer that logs each bot api call', async () => {
  const calls: DebugCall[] = []
  const transformerHolder: { fn?: Transformer } = {}
  const ctx = makeContext(calls, transformerHolder) as unknown as Context

  await updateLogger()(ctx, async () => {})

  // The transformer fn is registered synchronously via ctx.api.config.use
  assert.ok(transformerHolder.fn)

  // Calling the transformer should log the call and delegate to previous
  let previousCalled = false
  const previous = (method: string, payload: unknown) => {
    previousCalled = true
    return `${method}:${JSON.stringify(payload)}`
  }
  const result = transformerHolder.fn!(previous, 'sendMessage', { text: 'hi' }, null)

  assert.equal(previousCalled, true)
  assert.equal(result, 'sendMessage:{"text":"hi"}')

  // The transformer's debug log should now be in calls (appended after the "update received"/"update processed" pair)
  const apiCallLogs = calls.filter((c) => c.msg === 'bot api call')
  assert.equal(apiCallLogs.length, 1)
  assert.equal(apiCallLogs[0].method, 'sendMessage')
  assert.deepEqual(apiCallLogs[0].payload, { text: 'hi' })
})
