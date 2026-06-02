import { Buffer } from 'node:buffer'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Verify the `rocket-pay-signature` header. Matches xRocket's official SDK:
// secret = sha256(token); signature = HMAC_SHA256(secret, rawBody) hex.
// Timing-safe comparison; any malformed input returns false rather than throwing.
export function verifyWebhookSignature(rawBody: string, signature: string, token: string): boolean {
  if (!rawBody || !signature || !token)
    return false
  try {
    const secret = createHash('sha256').update(token).digest()
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(signature, 'hex')
    if (a.length !== b.length)
      return false
    return timingSafeEqual(a, b)
  }
  catch {
    return false
  }
}

export interface InvoicePayment {
  paymentId: string
  invoiceId: number
  payload: string
  userId: number
  amount: number
  currency: string
}

// Parse and validate an `invoicePay` webhook body. Throws on anything that is
// not a well-formed invoice-payment event.
export function parseInvoicePayment(rawBody: string): InvoicePayment {
  let parsed: any
  try {
    parsed = JSON.parse(rawBody)
  }
  catch {
    throw new Error('Invalid webhook JSON')
  }
  if (!parsed || parsed.type !== 'invoicePay' || !parsed.data || !parsed.data.payment) {
    throw new Error('Not an invoicePay webhook')
  }
  const { data } = parsed
  const { payment } = data
  if (typeof payment.id !== 'string' || typeof payment.paymentAmount !== 'number') {
    throw new TypeError('Malformed invoicePay payload')
  }
  return {
    paymentId: payment.id,
    invoiceId: data.id,
    payload: typeof data.payload === 'string' ? data.payload : '',
    userId: payment.userId,
    amount: payment.paymentAmount,
    currency: typeof data.currency === 'string' ? data.currency : '',
  }
}
