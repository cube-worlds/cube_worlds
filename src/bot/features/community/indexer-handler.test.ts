/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndexerHandler } from '#root/bot/features/community/indexer-handler'

function ctx() {
  const rows: Array<[number, number, number]> = []
  const handle = buildIndexerHandler({ indexChatMessage: async (c, m, a) => { rows.push([c, m, a]) } })
  return { rows, handle }
}

test('indexes a human message', async () => {
  const { rows, handle } = ctx()
  await handle({ chat: { id: -100 }, message_id: 7, from: { id: 42, is_bot: false } })
  assert.deepEqual(rows, [[-100, 7, 42]])
})

test('skips bots, anonymous admins and missing senders', async () => {
  const { rows, handle } = ctx()
  await handle({ chat: { id: -100 }, message_id: 8, from: { id: 1, is_bot: true } })
  await handle({ chat: { id: -100 }, message_id: 9, from: { id: 42, is_bot: false }, sender_chat: { id: -100 } })
  await handle({ chat: { id: -100 }, message_id: 10 })
  assert.deepEqual(rows, [])
})
