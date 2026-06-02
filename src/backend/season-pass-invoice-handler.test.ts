/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { SeasonPassInvoiceHandlerDependencies } from '#root/backend/season-pass-invoice-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildSeasonPassInvoiceHandler } from '#root/backend/season-pass-invoice-handler'

function makeDeps(overrides: Partial<SeasonPassInvoiceHandlerDependencies> = {}) {
  const calls = { created: [] as number[] }
  const deps: SeasonPassInvoiceHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, _id: 'u7' } as any) : null),
    createStarsInvoiceLink: async ({ userId }) => { calls.created.push(userId); return `https://t.me/$inv?u=${userId}` },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: SeasonPassInvoiceHandlerDependencies) {
  const app = fastify()
  await app.register(buildSeasonPassInvoiceHandler(d), { prefix: '/api/game' })
  return app
}

test('returns a Stars invoice link for the authenticated user', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/season-pass/invoice', payload: { initData: 'x' } })
  assert.equal(res.json().link, 'https://t.me/$inv?u=7')
  assert.deepEqual(calls.created, [7])
})

test('rejects when no initData is provided', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/season-pass/invoice', payload: {} })
  assert.equal(res.json().error, 'No initData provided')
})
