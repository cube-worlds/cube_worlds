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
    accruals: [] as any[],
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
    accrueRewards: async (e) => { calls.accruals.push(e) },
    areWithdrawalsPaused: async () => false,
    generateId: () => 'gen_1',
    callbackUrl: () => 'https://app.test/api/wallet/webhook',
    xrocket: {
      createInvoice: async (i) => { calls.invoices.push(i); return { id: 1, link: 'https://t.me/inv/1', status: 'active', currency: 'USDT', amount: i.amount, payload: i.payload } },
      transfer: async (i) => { calls.transfers.push(i); return { id: 9 } },
      withdrawal: async (i) => { calls.withdrawals.push(i); return { status: 'CREATED', txHash: null, txLink: null } },
      getWithdrawalFees: async () => [{ code: 'USDT', minWithdraw: 1, fees: [{ networkCode: 'TON', feeWithdraw: { fee: 0.1, currency: 'USDT' } }] }],
      appInfo: async () => ({ name: 'app', feePercents: 0, balances: [] }),
      multiCheque: async () => ({ id: 1, link: 'https://t.me/cq/1', state: 'active' }),
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

test('POST /buy-energy debits the pack price and grants energy', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/buy-energy', payload: { initData: 'x' } })
  const b = res.json()
  assert.equal(b.energy, 120)
  assert.deepEqual(calls.debits, [500_000n]) // 0.5 USDT
  assert.deepEqual(calls.granted, [120])
  assert.equal(calls.ledger[0].type, 'buy_energy')
  assert.equal(calls.ledger[0].amount, -500_000n) // debit is negative
  // 20% of the 0.5 USDT pack price accrues to the rewards pool, idempotent on
  // the debit's ledger id.
  assert.equal(calls.accruals.length, 1)
  assert.equal(calls.accruals[0].amount, 100_000n) // 20% of 500_000
  assert.equal(calls.accruals[0].externalId, 'accrual:buyenergy:gen_1')
})

test('POST /buy-energy still succeeds if the rewards accrual fails', async (t) => {
  const { deps, calls } = makeDeps({
    accrueRewards: async () => { throw new Error('pool write boom') },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/buy-energy', payload: { initData: 'x' } })
  assert.equal(res.json().energy, 120) // purchase unaffected
  assert.deepEqual(calls.granted, [120])
})

test('POST /buy-energy rejects when balance is insufficient (no energy granted)', async (t) => {
  const { deps, calls } = makeDeps({
    applyDebit: async () => { throw new (await import('#root/common/errors')).ClientError('Insufficient balance') },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/buy-energy', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'Insufficient balance')
  assert.equal(calls.granted.length, 0)
})

test('POST /transfer debits the sender and calls xRocket transfer', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/transfer', payload: { initData: 'x', tgUserId: 99, amount: 1 } })
  assert.equal(res.json().ok, true)
  assert.deepEqual(calls.debits, [1_000_000n])
  assert.equal(calls.transfers[0].tgUserId, 99)
  assert.equal(calls.transfers[0].transferId, 'gen_1')
  assert.equal(calls.transfers[0].amount, 1)
})

test('POST /transfer refunds the balance when xRocket fails', async (t) => {
  const { deps, calls } = makeDeps({
    xrocket: { ...makeDeps().deps.xrocket, transfer: async () => { throw new Error('xRocket down') } },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/transfer', payload: { initData: 'x', tgUserId: 99, amount: 1 } })
  assert.equal(res.json().error, 'Transfer failed, balance refunded')
  assert.deepEqual(calls.debits, [1_000_000n])
  assert.deepEqual(calls.credits, [1_000_000n]) // refunded
})

test('POST /withdraw debits amount plus fee and calls xRocket withdrawal', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/withdraw', payload: { initData: 'x', network: 'TON', address: 'EQabc', amount: 1 } })
  const b = res.json()
  assert.equal(b.status, 'CREATED')
  assert.equal(b.feeUsdt, 0.1)
  assert.deepEqual(calls.debits, [1_100_000n]) // 1 USDT + 0.1 fee
  assert.equal(calls.withdrawals[0].network, 'TON')
  assert.equal(calls.withdrawals[0].withdrawalId, 'gen_1')
})

test('POST /withdraw is refused when withdrawals are paused', async (t) => {
  const { deps, calls } = makeDeps({ areWithdrawalsPaused: async () => true })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/withdraw', payload: { initData: 'x', network: 'TON', address: 'EQabc', amount: 1 } })
  assert.equal(res.json().error, 'Withdrawals are temporarily paused')
  assert.equal(calls.debits.length, 0)
})

test('POST /withdraw rejects an amount below the network minimum', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/wallet/withdraw', payload: { initData: 'x', network: 'TON', address: 'EQabc', amount: 0.5 } })
  assert.equal(res.json().error, 'Below minimum withdrawal')
})
