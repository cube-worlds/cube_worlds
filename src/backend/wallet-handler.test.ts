/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { WalletHandlerDependencies } from '#root/backend/wallet-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildWalletHandler } from '#root/backend/wallet-handler'

export function makeDeps(overrides: Partial<WalletHandlerDependencies> = {}) {
  const calls = {
    invoices: [] as any[],
    withdrawals: [] as any[],
    transfers: [] as any[],
    debits: [] as bigint[],
    credits: [] as bigint[],
    granted: [] as number[],
    ledger: [] as any[],
  }
  const deps: WalletHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, _id: 'u7' } as any) : null),
    getBalance: async () => 2_000_000n, // 2 USDT
    applyDebit: async (_id, amount) => { calls.debits.push(amount); return 2_000_000n - amount },
    creditBalance: async (_id, amount) => { calls.credits.push(amount); return amount },
    grantEnergy: async (_u, amount) => { calls.granted.push(amount); return amount },
    insertLedgerEntry: async (e) => { calls.ledger.push(e); return { _id: 'l1' } },
    setLedgerStatus: async () => {},
    areWithdrawalsPaused: async () => false,
    generateId: () => 'gen_1',
    callbackUrl: () => 'https://app.test/api/wallet/webhook',
    xrocket: {
      createInvoice: async (i) => { calls.invoices.push(i); return { id: 1, link: 'https://t.me/inv/1', status: 'active', currency: 'USDT', amount: i.amount, payload: i.payload } },
      transfer: async (i) => { calls.transfers.push(i); return { id: 9 } },
      withdrawal: async (i) => { calls.withdrawals.push(i); return { status: 'CREATED', txHash: null, txLink: null } },
      getWithdrawalFees: async () => [{ code: 'USDT', minWithdraw: 1, fees: [{ networkCode: 'TON', feeWithdraw: { fee: 0.1, currency: 'USDT' } }] }],
      appInfo: async () => ({ name: 'app', feePercents: 0, balances: [] }),
    },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

export async function appWith(d: WalletHandlerDependencies) {
  const app = fastify()
  await app.register(buildWalletHandler(d), { prefix: '/api/wallet' })
  return app
}

test('POST /balance returns the USDT balance', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/balance', payload: { initData: 'x' } })
  const b = res.json()
  assert.equal(b.balance, 2)
  assert.equal(b.currency, 'USDT')
})

test('POST /invoice creates a USDT invoice tagged with the user payload', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/invoice', payload: { initData: 'x', amount: 5 } })
  assert.equal(res.json().link, 'https://t.me/inv/1')
  assert.equal(calls.invoices[0].payload, 'u:7')
  assert.equal(calls.invoices[0].currency, 'USDT')
  assert.equal(calls.invoices[0].callbackUrl, 'https://app.test/api/wallet/webhook')
  assert.equal(calls.invoices[0].amount, 5)
})

test('POST /invoice rejects a non-positive amount', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/invoice', payload: { initData: 'x', amount: 0 } })
  assert.equal(res.json().error, 'Invalid amount')
})

test('POST /balance errors for an unknown user', async (t) => {
  const { deps } = makeDeps({ findUserById: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/balance', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'User not found in database')
})
