/* eslint-disable test/no-import-node-test */
import type { JoinUpdate } from '#root/bot/features/community/join-handler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildJoinHandler, parseInviterId } from '#root/bot/features/community/join-handler'

function ctx() {
  const created: number[] = []
  const referrals: Array<[number, number, string]> = []
  const handle = buildJoinHandler({
    findOrCreateUser: async (id) => { created.push(id); return { id } },
    setChatReferral: async (j, i, l) => { referrals.push([j, i, l]); return true },
    logInfo: () => {},
  })
  return { created, referrals, handle }
}

function join(overrides: Partial<JoinUpdate> = {}): JoinUpdate {
  return {
    chat: { id: -100 },
    from: { id: 9 },
    old_chat_member: { status: 'left' },
    new_chat_member: { status: 'member', user: { id: 9, is_bot: false, language_code: 'ru' } },
    invite_link: { name: '42' },
    ...overrides,
  }
}

test('parseInviterId accepts a positive integer name only', () => {
  assert.equal(parseInviterId('42'), 42)
  assert.equal(parseInviterId('abc'), null)
  assert.equal(parseInviterId('-5'), null)
  assert.equal(parseInviterId(undefined), null)
})

test('a join via a personal link creates the shell and sets the referral', async () => {
  const { created, referrals, handle } = ctx()
  await handle(join())
  assert.deepEqual(created, [9])
  assert.deepEqual(referrals, [[9, 42, 'ru']])
})

test('non-ru language codes fall back to en', async () => {
  const { referrals, handle } = ctx()
  await handle(join({ new_chat_member: { status: 'member', user: { id: 9, is_bot: false, language_code: 'de' } } }))
  assert.deepEqual(referrals, [[9, 42, 'en']])
})

test('ignores self-invites, bots, non-joins and links without a numeric name', async () => {
  const { referrals, handle } = ctx()
  await handle(join({ invite_link: { name: '9' } }))
  await handle(join({ new_chat_member: { status: 'member', user: { id: 9, is_bot: true } } }))
  await handle(join({ old_chat_member: { status: 'member' }, new_chat_member: { status: 'administrator', user: { id: 9, is_bot: false } } }))
  await handle(join({ invite_link: { name: 'EN main link' } }))
  await handle(join({ invite_link: undefined }))
  assert.deepEqual(referrals, [])
})
