/* eslint-disable test/no-import-node-test */
import type { WalletWebhookDependencies } from '#root/backend/wallet-webhook-handler'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import fastify from 'fastify'
import { buildWalletWebhookHandler } from '#root/backend/wallet-webhook-handler'

const TOKEN = 'tok_secret'
function sign(body: string): string {
  const secret = createHash('sha256').update(TOKEN).digest()
  return createHmac('sha256', secret).update(body).digest('hex')
}

function makeDeps(overrides: Partial<WalletWebhookDependencies> = {}) {
  const calls = { credits: [] as bigint[], ledger: [] as any[] }
  const deps: WalletWebhookDependencies = {
    apiKey: () => TOKEN,
    insertLedgerEntry: async (e) => { calls.ledger.push(e); return { _id: 'l1' } as any },
    setLedgerStatus: async () => {},
    creditBalance: async (_userId, amount) => { calls.credits.push(amount); return amount },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: WalletWebhookDependencies) {
  const app = fastify()
  await app.register(buildWalletWebhookHandler(d), { prefix: '/api/wallet' })
  return app
}

function body() {
  return JSON.stringify({
    type: 'invoicePay',
    timestamp: 't',
    data: { id: 1, payload: 'u:7', currency: 'USDT', payment: { id: 'pay_abc', userId: 7, paymentAmount: 1.5 } },
  })
}

test('credits the user idempotently on a validly signed deposit', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const payload = body()
  const res = await app.inject({
    method: 'POST',
    url: '/api/wallet/webhook',
    headers: { 'content-type': 'application/json', 'rocket-pay-signature': sign(payload) },
    payload,
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls.credits, [1_500_000n]) // 1.5 USDT in micro
  assert.equal(calls.ledger[0].externalId, 'pay_abc')
})

test('rejects an invalid signature with 401 and credits nobody', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const payload = body()
  const res = await app.inject({
    method: 'POST',
    url: '/api/wallet/webhook',
    headers: { 'content-type': 'application/json', 'rocket-pay-signature': 'bad' },
    payload,
  })
  assert.equal(res.statusCode, 401)
  assert.equal(calls.credits.length, 0)
})

test('a replayed payment (duplicate externalId) is a 200 no-op', async (t) => {
  const { deps, calls } = makeDeps({
    insertLedgerEntry: async () => { throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 }) },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const payload = body()
  const res = await app.inject({
    method: 'POST',
    url: '/api/wallet/webhook',
    headers: { 'content-type': 'application/json', 'rocket-pay-signature': sign(payload) },
    payload,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(calls.credits.length, 0)
})
