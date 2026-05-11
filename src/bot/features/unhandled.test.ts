/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  handleUnhandledCallbackQuery,
  handleUnhandledMessage,
} from '#root/bot/features/unhandled'

test('handleUnhandledMessage replies with the translated "unhandled" key', async () => {
  const replyCalls: string[] = []
  const tCalls: string[] = []
  const ctx = {
    reply: async (text: string) => { replyCalls.push(text); return text },
    t: (key: string) => { tCalls.push(key); return `t(${key})` },
  } as unknown as Context

  await handleUnhandledMessage(ctx)
  assert.deepEqual(tCalls, ['unhandled'])
  assert.deepEqual(replyCalls, ['t(unhandled)'])
})

test('handleUnhandledCallbackQuery just acknowledges the callback query', async () => {
  let answered = false
  const ctx = {
    answerCallbackQuery: async () => { answered = true },
  } as unknown as Context

  await handleUnhandledCallbackQuery(ctx)
  assert.equal(answered, true)
})
