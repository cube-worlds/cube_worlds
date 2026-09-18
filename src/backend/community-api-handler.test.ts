/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { CommunityApiDependencies, CommunityUser } from '#root/backend/community-api-handler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fastify from 'fastify'
import { buildCommunityApiHandler } from '#root/backend/community-api-handler'

interface Ctx {
  app: ReturnType<typeof fastify>
  user: CommunityUser
  createdLinks: Array<[number, string]>
  savedLinks: Array<[number, number, string]>
  errors: string[]
}

async function createCtx(overrides: Partial<CommunityApiDependencies> = {}, userOverrides: Partial<CommunityUser> = {}): Promise<Ctx> {
  const user: CommunityUser = { id: 1001, pass: { index: 7 }, rep: { helped: 120, gave: 0 }, inviteLinks: { '-100': 'https://t.me/+cached' }, ...userOverrides }
  const ctx: Ctx = { app: fastify(), user, createdLinks: [], savedLinks: [], errors: [] }
  const deps: CommunityApiDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findUser: async id => (id === 1001 ? user : null),
    chatIds: [-100, -200],
    tipVotes: 50n,
    basePerDay: 3,
    repPerExtra: 100,
    now: () => new Date('2026-09-17T10:00:00Z'),
    countTipsSince: async () => 1,
    chatTitle: async chatId => (chatId === -100 ? 'EN' : 'RU'),
    createInviteLink: async (chatId, name) => { ctx.createdLinks.push([chatId, name]); return `https://t.me/+new${chatId}` },
    saveInviteLink: async (userId, chatId, url) => { ctx.savedLinks.push([userId, chatId, url]) },
    countInvitedLoggedIn: async () => 3,
    logError: m => { ctx.errors.push(m) },
    ...overrides,
  }
  await ctx.app.register(buildCommunityApiHandler(deps))
  return ctx
}

async function call(ctx: Ctx) {
  const res = await ctx.app.inject({ method: 'POST', url: '/community', payload: { initData: 'x' } })
  return { status: res.statusCode, body: res.json() }
}

test('holder sees allowance, cached + newly created links, invited count', async () => {
  const ctx = await createCtx()
  const { status, body } = await call(ctx)
  assert.equal(status, 200)
  assert.deepEqual(body.tips, { perDay: 4, left: 3, votes: '50' })
  assert.deepEqual(body.invites, [
    { chatId: '-100', title: 'EN', url: 'https://t.me/+cached' },
    { chatId: '-200', title: 'RU', url: 'https://t.me/+new-200' },
  ])
  assert.deepEqual(ctx.createdLinks, [[-200, '1001']])
  assert.deepEqual(ctx.savedLinks, [[1001, -200, 'https://t.me/+new-200']])
  assert.equal(body.invitedLoggedIn, 3)
})

test('non-holder gets tips: null but still gets invite links', async () => {
  const ctx = await createCtx({}, { pass: undefined })
  const { body } = await call(ctx)
  assert.equal(body.tips, null)
  assert.equal(body.invites.length, 2)
})

test('a Telegram failure drops that chat and logs, response still 200', async () => {
  const ctx = await createCtx({ createInviteLink: async () => { throw new Error('not admin') } })
  const { status, body } = await call(ctx)
  assert.equal(status, 200)
  assert.deepEqual(body.invites.map((i: { chatId: string }) => i.chatId), ['-100'])
  assert.equal(ctx.errors.length, 1)
})

test('no community chats configured ⇒ empty invites', async () => {
  const ctx = await createCtx({ chatIds: [] })
  const { body } = await call(ctx)
  assert.deepEqual(body.invites, [])
})
