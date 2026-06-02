/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildXRocketClient } from '#root/common/helpers/xrocket'

function fakeFetch(captured: any[], response: unknown, ok = true, status = 200) {
  return async (url: string, init: any) => {
    captured.push({ url, init })
    return {
      ok,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    }
  }
}

function client(fetchImpl: any) {
  return buildXRocketClient({ fetch: fetchImpl, apiKey: 'tok_123', baseUrl: 'https://x.test/api' })
}

test('createInvoice posts to /tg-invoices with the key header and returns data', async () => {
  const captured: any[] = []
  const c = client(fakeFetch(captured, { success: true, data: { id: 1, link: 'https://t.me/inv/1' } }))
  const data = await c.createInvoice({ amount: 1.5, currency: 'USDT', payload: 'u:7', callbackUrl: 'https://app/cb' })
  assert.equal(data.id, 1)
  assert.equal(data.link, 'https://t.me/inv/1')
  assert.equal(captured[0].url, 'https://x.test/api/tg-invoices')
  assert.equal(captured[0].init.method, 'POST')
  assert.equal(captured[0].init.headers['Rocket-Pay-Key'], 'tok_123')
  assert.equal(captured[0].init.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(captured[0].init.body), {
    amount: 1.5,
    currency: 'USDT',
    payload: 'u:7',
    callbackUrl: 'https://app/cb',
    numPayments: 1,
  })
})

test('transfer posts to /app/transfer with tgUserId, amount and transferId', async () => {
  const captured: any[] = []
  const c = client(fakeFetch(captured, { success: true, data: { id: 9 } }))
  await c.transfer({ tgUserId: 42, currency: 'USDT', amount: 2, transferId: 'tr_1', description: 'payout' })
  assert.equal(captured[0].url, 'https://x.test/api/app/transfer')
  assert.deepEqual(JSON.parse(captured[0].init.body), {
    tgUserId: 42,
    currency: 'USDT',
    amount: 2,
    transferId: 'tr_1',
    description: 'payout',
  })
})

test('withdrawal posts to /app/withdrawal and returns status fields', async () => {
  const captured: any[] = []
  const c = client(fakeFetch(captured, { success: true, data: { status: 'CREATED', txHash: null } }))
  const data = await c.withdrawal({ network: 'TON', address: 'EQ...', currency: 'USDT', amount: 3, withdrawalId: 'wd_1' })
  assert.equal(data.status, 'CREATED')
  assert.equal(captured[0].url, 'https://x.test/api/app/withdrawal')
})

test('getWithdrawalFees GETs /app/withdrawal/fees with a currency query', async () => {
  const captured: any[] = []
  const c = client(fakeFetch(captured, { success: true, data: [{ code: 'USDT', minWithdraw: 1, fees: [] }] }))
  const data = await c.getWithdrawalFees('USDT')
  assert.equal(data[0].code, 'USDT')
  assert.equal(captured[0].url, 'https://x.test/api/app/withdrawal/fees?currency=USDT')
  assert.equal(captured[0].init.method, 'GET')
})

test('appInfo GETs /app/info and returns balances', async () => {
  const captured: any[] = []
  const c = client(fakeFetch(captured, { success: true, data: { name: 'app', feePercents: 0, balances: [{ currency: 'USDT', balance: 100 }] } }))
  const data = await c.appInfo()
  assert.equal(data.balances[0].balance, 100)
})

test('throws when the HTTP response is not ok', async () => {
  const c = client(fakeFetch([], { success: false, message: 'bad' }, false, 400))
  await assert.rejects(() => c.appInfo(), /xRocket/)
})

test('throws when the body reports success:false', async () => {
  const c = client(fakeFetch([], { success: false, message: 'no funds' }, true, 200))
  await assert.rejects(() => c.appInfo(), /no funds/)
})
