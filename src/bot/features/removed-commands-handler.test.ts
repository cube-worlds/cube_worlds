/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRemovedCommandsHandler } from '#root/bot/features/removed-commands-handler'

interface ReplyCall {
  text: string
  options?: { reply_markup?: { inline_keyboard: any[][] } }
}

function makeCtx() {
  const replyCalls: ReplyCall[] = []
  return {
    replyCalls,
    t: (key: string) => `t(${key})`,
    reply: async (text: string, options?: ReplyCall['options']) => {
      replyCalls.push({ text, options })
    },
  }
}

test('removed-commands handler replies with removed_command.message', async () => {
  const ctx = makeCtx()
  const handler = buildRemovedCommandsHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].text, 't(removed_command.message)')
})

test('removed-commands handler includes a Web App button with the configured URL', async () => {
  const ctx = makeCtx()
  const handler = buildRemovedCommandsHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  const keyboard = ctx.replyCalls[0].options?.reply_markup?.inline_keyboard
  assert.ok(keyboard)
  assert.equal(keyboard[0][0].text, 't(menu_button.label)')
  assert.deepEqual(keyboard[0][0].web_app, { url: 'https://app.example' })
})
