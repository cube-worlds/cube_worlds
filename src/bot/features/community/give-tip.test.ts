/* eslint-disable test/no-import-node-test */
import type { GiveTipDependencies, TipUser } from '#root/bot/features/community/give-tip'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildGiveTip, tipsPerDay, utcMidnight } from '#root/bot/features/community/give-tip'
import { BalanceChangeType } from '#root/common/models/Balance'

const NOW = new Date('2026-09-17T10:00:00Z')

interface Ctx {
  users: Map<number, TipUser>
  tips: Array<{ tipperId: number, recipientId: number, chatId: number, messageId: number, votes: bigint }>
  credits: Array<[number, bigint, BalanceChangeType]>
  reactions: Array<{ chatId: number, messageId: number }>
  replies: Array<{ chatId: number, messageId: number, text: string }>
  joinedViaChat: number[]
  nudged: number[]
  errors: string[]
  deps: GiveTipDependencies
}

function createCtx(overrides: Partial<GiveTipDependencies> = {}, tipperOverrides: Partial<TipUser> = {}): Ctx {
  const users = new Map<number, TipUser>([
    [1, { id: 1, pass: { index: 7 }, rep: { helped: 0, gave: 0 }, firstLoginAt: NOW, ...tipperOverrides }],
    [2, { id: 2, firstLoginAt: NOW, name: 'bob' }],
  ])
  const ctx = {
    users, tips: [], credits: [], reactions: [], replies: [], joinedViaChat: [], nudged: [], errors: [],
  } as unknown as Ctx
  ctx.deps = {
    tipVotes: 50n,
    basePerDay: 3,
    repPerExtra: 100,
    now: () => NOW,
    findUserById: async id => users.get(id) ?? null,
    findOrCreateUser: async (id) => {
      if (!users.has(id)) users.set(id, { id })
      return users.get(id)!
    },
    countTipsSince: async tipperId => ctx.tips.filter(t => t.tipperId === tipperId).length,
    recordTip: async (tip) => {
      if (ctx.tips.some(t => t.chatId === tip.chatId && t.messageId === tip.messageId && t.tipperId === tip.tipperId)) return false
      ctx.tips.push(tip)
      return true
    },
    addPoints: async (userId, votes, reason) => {
      ctx.credits.push([userId, votes, reason])
      return votes
    },
    markJoinedViaChat: async (id) => { ctx.joinedViaChat.push(id) },
    markCommunityNudged: async (id) => { ctx.nudged.push(id) },
    react: async (chatId, messageId) => { ctx.reactions.push({ chatId, messageId }) },
    reply: async (chatId, messageId, text) => { ctx.replies.push({ chatId, messageId, text }) },
    translate: (locale, key, vars) => `${locale}:${key}:${JSON.stringify(vars)}`,
    logError: (message) => { ctx.errors.push(message) },
    ...overrides,
  }
  return ctx
}

const INPUT = { tipperId: 1, recipientId: 2, chatId: -100, messageId: 55, recipientName: 'bob' }

test('utcMidnight truncates to 00:00 UTC', () => {
  assert.equal(utcMidnight(NOW).toISOString(), '2026-09-17T00:00:00.000Z')
})

test('tipsPerDay = base + floor((helped+gave)/repPerExtra)', () => {
  assert.equal(tipsPerDay(undefined, 3, 100), 3)
  assert.equal(tipsPerDay({ helped: 40, gave: 59 }, 3, 100), 3)
  assert.equal(tipsPerDay({ helped: 150, gave: 60 }, 3, 100), 5)
})

test('a holder tip credits the recipient and reacts on the message', async () => {
  const ctx = createCtx()
  const result = await buildGiveTip(ctx.deps)(INPUT)
  assert.deepEqual(result, { ok: true, votes: 50n })
  assert.deepEqual(ctx.credits, [[2, 50n, BalanceChangeType.Tip]])
  assert.deepEqual(ctx.reactions, [{ chatId: -100, messageId: 55 }])
  assert.equal(ctx.replies.length, 0, 'registered recipient gets no text')
  assert.deepEqual(ctx.joinedViaChat, [])
})

test('self tip is rejected before any write', async () => {
  const ctx = createCtx()
  const result = await buildGiveTip(ctx.deps)({ ...INPUT, recipientId: 1 })
  assert.deepEqual(result, { ok: false, reason: 'self' })
  assert.equal(ctx.tips.length, 0)
})

test('a non-holder cannot tip', async () => {
  const ctx = createCtx({}, { pass: undefined })
  const result = await buildGiveTip(ctx.deps)(INPUT)
  assert.deepEqual(result, { ok: false, reason: 'holders_only' })
  assert.equal(ctx.tips.length, 0)
})

test('allowance is exhausted after base + rep tips', async () => {
  const ctx = createCtx({}, { rep: { helped: 100, gave: 0 } })
  const give = buildGiveTip(ctx.deps)
  for (let m = 1; m <= 4; m++) assert.equal((await give({ ...INPUT, messageId: m })).ok, true)
  assert.deepEqual(await give({ ...INPUT, messageId: 5 }), { ok: false, reason: 'no_allowance' })
  assert.equal(ctx.credits.length, 4)
})

test('the same tipper on the same message is a duplicate no-op', async () => {
  const ctx = createCtx()
  const give = buildGiveTip(ctx.deps)
  await give(INPUT)
  assert.deepEqual(await give(INPUT), { ok: false, reason: 'duplicate' })
  assert.equal(ctx.credits.length, 1)
})

test('tipping a stranger creates a shell, marks joinedViaChat, nudges once', async () => {
  const ctx = createCtx()
  const give = buildGiveTip(ctx.deps)
  await give({ ...INPUT, recipientId: 9, recipientName: 'carol', recipientLanguage: 'ru' })
  assert.ok(ctx.users.has(9), 'shell created')
  assert.deepEqual(ctx.joinedViaChat, [9])
  assert.equal(ctx.replies.length, 1)
  assert.match(ctx.replies[0].text, /^ru:community_nudge:/)
  assert.match(ctx.replies[0].text, /"name":"carol"/)
  assert.deepEqual(ctx.nudged, [9])
  // second tip from another message: still unregistered, but already nudged
  ctx.users.get(9)!.communityNudgedAt = NOW
  await give({ ...INPUT, recipientId: 9, messageId: 56, recipientName: 'carol' })
  assert.equal(ctx.replies.length, 1)
})

test('side-effect failures never fail the tip', async () => {
  const ctx = createCtx({
    react: async () => { throw new Error('telegram down') },
    reply: async () => { throw new Error('telegram down') },
  })
  const result = await buildGiveTip(ctx.deps)({ ...INPUT, recipientId: 9, recipientName: 'carol' })
  assert.equal(result.ok, true)
  assert.equal(ctx.errors.length, 2)
})

test('credit failure is reported and logged', async () => {
  const ctx = createCtx({ addPoints: async () => { throw new Error('mongo down') } })
  const result = await buildGiveTip(ctx.deps)(INPUT)
  assert.deepEqual(result, { ok: false, reason: 'credit_failed' })
  assert.equal(ctx.errors.length, 1)
})
