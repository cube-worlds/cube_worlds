/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { TopupInvoiceHandlerDependencies } from '#root/backend/topup-invoice-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import {
  buildTopupInvoiceHandler,
  buildTopupPayload,
} from '#root/backend/topup-invoice-handler'

interface InvoiceCall {
  title: string
  description: string
  payload: string
  stars: number
}

async function createContext(
  overrides: Partial<TopupInvoiceHandlerDependencies> = {},
) {
  const invoiceCalls: InvoiceCall[] = []
  const dependencies: TopupInvoiceHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    votesPerStar: () => 10n,
    createInvoiceLink: async (args) => {
      invoiceCalls.push(args)
      return 'https://t.me/invoice/abc'
    },
    logError: () => {},
    ...overrides,
  }
  const app = fastify()
  await app.register(buildTopupInvoiceHandler(dependencies), {
    prefix: '/api/users',
  })
  return { app, invoiceCalls }
}

test('buildTopupPayload encodes user, stars, and quoted votes', () => {
  assert.equal(buildTopupPayload(1001, 250, 2500n), 'cube-topup:1001:250:2500')
})

test('POST /topup/invoice quotes votes at the configured rate and returns the link', async (t) => {
  const ctx = await createContext()
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/topup/invoice',
    payload: { initData: 'signed', stars: 250 },
  })

  const body = res.json()
  assert.equal(body.link, 'https://t.me/invoice/abc')
  assert.equal(body.votes, '2500')
  assert.equal(body.stars, 250)
  assert.equal(ctx.invoiceCalls.length, 1)
  assert.equal(ctx.invoiceCalls[0].payload, 'cube-topup:1001:250:2500')
  assert.equal(ctx.invoiceCalls[0].stars, 250)
})

test('POST /topup/invoice rejects out-of-range star amounts', async (t) => {
  const ctx = await createContext()
  t.after(() => ctx.app.close())

  for (const stars of [0, -5, 2501, 1.5]) {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users/topup/invoice',
      payload: { initData: 'signed', stars },
    })
    assert.equal(res.json().error, 'Invalid request body', `stars=${stars}`)
  }
  assert.equal(ctx.invoiceCalls.length, 0)
})

test('POST /topup/invoice requires initData', async (t) => {
  const ctx = await createContext()
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/users/topup/invoice',
    payload: { stars: 100 },
  })
  assert.equal(res.json().error, 'No initData or hash provided')
})
