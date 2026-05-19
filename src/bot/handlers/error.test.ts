/* eslint-disable test/no-import-node-test */
import type { BotError } from 'grammy'
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorHandler } from '#root/bot/handlers/error'

interface ErrorCall {
  err: unknown
  update: unknown
}

function makeBotError(underlying: unknown, update: object): BotError<Context> {
  const errorCalls: ErrorCall[] = []
  const ctx = {
    logger: {
      error: (entry: ErrorCall) => { errorCalls.push(entry) },
    },
    update: { update_id: 99, ...update },
  } as unknown as Context

  return Object.assign(Object.create(Error.prototype), {
    ctx,
    error: underlying,
    _errorCalls: errorCalls,
  }) as unknown as BotError<Context> & { _errorCalls: ErrorCall[] }
}

test('errorHandler logs the underlying error and a stripped update payload', () => {
  const underlying = new Error('boom')
  const botError = makeBotError(underlying, { message: { text: '/start' } }) as
    BotError<Context> & { _errorCalls: ErrorCall[] }

  errorHandler(botError)

  assert.equal(botError._errorCalls.length, 1)
  assert.equal(botError._errorCalls[0].err, underlying)
  assert.deepEqual(botError._errorCalls[0].update, {
    message: { text: '/start' },
  })
})

test('errorHandler forwards non-Error underlying values verbatim', () => {
  const underlying = { code: 'TIMEOUT', detail: 'request took too long' }
  const botError = makeBotError(underlying, { callback_query: { id: 'cb1' } }) as
    BotError<Context> & { _errorCalls: ErrorCall[] }

  errorHandler(botError)

  assert.equal(botError._errorCalls.length, 1)
  assert.equal(botError._errorCalls[0].err, underlying)
  assert.deepEqual(botError._errorCalls[0].update, {
    callback_query: { id: 'cb1' },
  })
})
