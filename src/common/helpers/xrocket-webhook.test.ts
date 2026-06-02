/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import { parseInvoicePayment, verifyWebhookSignature } from '#root/common/helpers/xrocket-webhook'

const TOKEN = 'tok_secret'

function sign(body: string): string {
  const secret = createHash('sha256').update(TOKEN).digest()
  return createHmac('sha256', secret).update(body).digest('hex')
}

test('verifyWebhookSignature accepts a correctly signed body', () => {
  const body = '{"type":"invoicePay"}'
  assert.equal(verifyWebhookSignature(body, sign(body), TOKEN), true)
})

test('verifyWebhookSignature rejects a tampered body or wrong signature', () => {
  const body = '{"type":"invoicePay"}'
  assert.equal(verifyWebhookSignature('{"type":"x"}', sign(body), TOKEN), false)
  assert.equal(verifyWebhookSignature(body, 'deadbeef', TOKEN), false)
})

test('verifyWebhookSignature returns false on empty inputs', () => {
  assert.equal(verifyWebhookSignature('', sign('x'), TOKEN), false)
  assert.equal(verifyWebhookSignature('x', '', TOKEN), false)
  assert.equal(verifyWebhookSignature('x', sign('x'), ''), false)
})

test('parseInvoicePayment extracts payment id, payload, amount and currency', () => {
  const body = JSON.stringify({
    type: 'invoicePay',
    timestamp: '2026-06-02T00:00:00Z',
    data: {
      id: 1,
      payload: 'u:7',
      currency: 'USDT',
      payment: { id: 'pay_abc', userId: 42, paymentAmount: 1.5, paymentAmountReceived: 1.5 },
    },
  })
  const parsed = parseInvoicePayment(body)
  assert.equal(parsed.paymentId, 'pay_abc')
  assert.equal(parsed.payload, 'u:7')
  assert.equal(parsed.currency, 'USDT')
  assert.equal(parsed.amount, 1.5)
})

test('parseInvoicePayment throws on a non-invoicePay or malformed body', () => {
  assert.throws(() => parseInvoicePayment('not json'))
  assert.throws(() => parseInvoicePayment(JSON.stringify({ type: 'other' })))
  assert.throws(() => parseInvoicePayment(JSON.stringify({ type: 'invoicePay', data: {} })))
})
