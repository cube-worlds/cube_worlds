/* eslint-disable test/no-import-node-test */
import type { TipCommandMessage } from '#root/bot/features/community/command-tip-handler'
import type { GiveTipResult } from '#root/bot/features/community/give-tip'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCommandTipHandler } from '#root/bot/features/community/command-tip-handler'

function ctx(result: GiveTipResult = { ok: true, votes: 50n }) {
  const tips: Array<Record<string, unknown>> = []
  const replies: string[] = []
  const handle = buildCommandTipHandler({
    giveTip: async (input) => { tips.push(input); return result },
    reply: async (_chat, _to, text) => { replies.push(text) },
    translate: (locale, key) => `${locale}:${key}`,
    logError: () => {},
  })
  return { tips, replies, handle }
}

function msg(overrides: Partial<TipCommandMessage> = {}): TipCommandMessage {
  return {
    chat: { id: -100 },
    from: { id: 1 },
    reply_to_message: { message_id: 55, from: { id: 2, is_bot: false, first_name: 'Bob', username: 'bob', language_code: 'ru' } },
    ...overrides,
  }
}

test('/tip as a reply tips the replied author with name and language', async () => {
  const { tips, replies, handle } = ctx()
  await handle(msg(), 'en')
  assert.equal(tips.length, 1)
  assert.equal(tips[0].recipientId, 2)
  assert.equal(tips[0].recipientName, 'bob')
  assert.equal(tips[0].recipientLanguage, 'ru')
  assert.deepEqual(replies, [], 'success is silent')
})

test('rejections are echoed with a translated reason', async () => {
  const { replies, handle } = ctx({ ok: false, reason: 'no_allowance' })
  await handle(msg(), 'ru')
  assert.deepEqual(replies, ['ru:tip_no_allowance'])
})

test('duplicate is silent; not-a-reply, bot and anonymous targets get tip_invalid_target', async () => {
  const dup = ctx({ ok: false, reason: 'duplicate' })
  await dup.handle(msg(), 'en')
  assert.deepEqual(dup.replies, [])
  const { tips, replies, handle } = ctx()
  await handle(msg({ reply_to_message: undefined }), 'en')
  await handle(msg({ reply_to_message: { message_id: 1, from: { id: 3, is_bot: true, first_name: 'B' } } }), 'en')
  await handle(msg({ reply_to_message: { message_id: 1, from: { id: 3, is_bot: false, first_name: 'B' }, sender_chat: {} } }), 'en')
  assert.equal(tips.length, 0)
  assert.deepEqual(replies, ['en:tip_invalid_target', 'en:tip_invalid_target', 'en:tip_invalid_target'])
})
