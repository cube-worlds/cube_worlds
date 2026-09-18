/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndexerHandler } from '#root/bot/features/community/indexer-handler'

function ctx() {
  const rows: Array<[number, number, number, string | undefined]> = []
  const handle = buildIndexerHandler({ indexChatMessage: async (c, m, a, n) => { rows.push([c, m, a, n]) } })
  return { rows, handle }
}

test('indexes a human message with its author name (username over first_name)', async () => {
  const { rows, handle } = ctx()
  await handle({ chat: { id: -100 }, message_id: 7, from: { id: 42, is_bot: false, username: 'alice', first_name: 'Alice' } })
  assert.deepEqual(rows, [[-100, 7, 42, 'alice']])
})

test('falls back to first_name when there is no username', async () => {
  const { rows, handle } = ctx()
  await handle({ chat: { id: -100 }, message_id: 8, from: { id: 43, is_bot: false, first_name: 'Bob' } })
  assert.deepEqual(rows, [[-100, 8, 43, 'Bob']])
})

test('skips bots, anonymous admins and missing senders', async () => {
  const { rows, handle } = ctx()
  await handle({ chat: { id: -100 }, message_id: 8, from: { id: 1, is_bot: true } })
  await handle({ chat: { id: -100 }, message_id: 9, from: { id: 42, is_bot: false }, sender_chat: { id: -100 } })
  await handle({ chat: { id: -100 }, message_id: 10 })
  assert.deepEqual(rows, [])
})
