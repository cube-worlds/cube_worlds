/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHelpCommandHandler } from '#root/bot/features/help-handler'

interface ReplyCall {
  text: string
  options?: { reply_markup?: { inline_keyboard: any[][] } }
}

function makeCtx() {
  const replyCalls: ReplyCall[] = []
  const ctx = {
    replyCalls,
    t: (key: string) => `t(${key})`,
    reply: async (text: string, options?: ReplyCall['options']) => {
      replyCalls.push({ text, options })
    },
  }
  return ctx
}

test('help handler replies with the translated help.message text', async () => {
  const ctx = makeCtx()
  const handler = buildHelpCommandHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].text, 't(help.message)')
})

test('help handler attaches a Web App inline button to the configured URL with the menu_button label', async () => {
  const ctx = makeCtx()
  const handler = buildHelpCommandHandler({ webAppUrl: 'https://app.example' })

  await handler(ctx as unknown as Context)

  const keyboard = ctx.replyCalls[0].options?.reply_markup?.inline_keyboard
  assert.ok(keyboard)
  assert.equal(keyboard.length, 1)
  assert.equal(keyboard[0].length, 1)
  assert.equal(keyboard[0][0].text, 't(menu_button.label)')
  assert.deepEqual(keyboard[0][0].web_app, { url: 'https://app.example' })
})
