/* eslint-disable test/no-import-node-test */
import type { ReactionUpdate } from '#root/bot/features/community/reaction-tip-handler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReactionTipHandler } from '#root/bot/features/community/reaction-tip-handler'

function ctx(author: number | null = 2) {
  const tips: Array<Record<string, unknown>> = []
  const handle = buildReactionTipHandler({
    tipEmoji: '🧊',
    findChatMessageAuthor: async () => author,
    giveTip: async (input) => { tips.push(input); return { ok: true, votes: 50n } },
  })
  return { tips, handle }
}

function update(overrides: Partial<ReactionUpdate> = {}): ReactionUpdate {
  return {
    chat: { id: -100 },
    message_id: 55,
    user: { id: 1 },
    old_reaction: [],
    new_reaction: [{ type: 'emoji', emoji: '🧊' }],
    ...overrides,
  }
}

test('a newly added tip emoji tips the indexed author', async () => {
  const { tips, handle } = ctx()
  await handle(update())
  assert.equal(tips.length, 1)
  assert.equal(tips[0].tipperId, 1)
  assert.equal(tips[0].recipientId, 2)
  assert.equal(tips[0].messageId, 55)
})

test('ignores other emojis, already-present emoji, anonymous reactors and unknown messages', async () => {
  const { tips, handle } = ctx()
  await handle(update({ new_reaction: [{ type: 'emoji', emoji: '🔥' }] }))
  await handle(update({ old_reaction: [{ type: 'emoji', emoji: '🧊' }], new_reaction: [{ type: 'emoji', emoji: '🧊' }, { type: 'emoji', emoji: '🔥' }] }))
  await handle(update({ user: undefined }))
  assert.equal(tips.length, 0)
  const unknown = ctx(null)
  await unknown.handle(update())
  assert.equal(unknown.tips.length, 0)
})
