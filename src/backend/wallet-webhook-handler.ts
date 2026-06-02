import type { FastifyInstance, FastifyRequest } from 'fastify'
import { usdtToMicro, WalletEntryType } from '#root/common/helpers/wallet'
import { parseInvoicePayment, verifyWebhookSignature } from '#root/common/helpers/xrocket-webhook'
import { WalletEntryStatus } from '#root/common/models/WalletLedger'

export interface WalletWebhookDependencies {
  apiKey: () => string
  insertLedgerEntry: (entry: {
    userId: number
    type: WalletEntryType
    amount: bigint
    externalId: string
    status?: WalletEntryStatus
    meta?: Record<string, unknown>
  }) => Promise<{ _id: unknown }>
  setLedgerStatus: (externalId: string, status: WalletEntryStatus) => Promise<void>
  creditBalance: (userId: number, amount: bigint) => Promise<bigint>
  logError: (message: string) => void
}

// The invoice payload encodes the app user id as "u:<userId>".
function userIdFromPayload(payload: string): number | null {
  const match = /^u:(\d+)$/.exec(payload)
  return match ? Number(match[1]) : null
}

export function buildWalletWebhookHandler(deps: WalletWebhookDependencies) {
  return async function walletWebhookHandler(fastify: FastifyInstance) {
    // Capture the raw body for HMAC verification while still parsing JSON for
    // convenience. Scoped to this plugin instance (encapsulation), so other
    // handlers keep the default parser.
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req, bodyStr, done) => {
        try {
          done(null, { raw: bodyStr })
        }
        catch (err) {
          done(err as Error, undefined)
        }
      },
    )

    fastify.post('/webhook', async (request: FastifyRequest, reply) => {
      const rawBody = (request.body as { raw?: string } | undefined)?.raw ?? ''
      const signature = String(request.headers['rocket-pay-signature'] ?? '')

      if (!verifyWebhookSignature(rawBody, signature, deps.apiKey())) {
        return reply.code(401).send({ error: 'Invalid signature' })
      }

      try {
        const event = parseInvoicePayment(rawBody)
        const userId = userIdFromPayload(event.payload)
        if (!userId) {
          deps.logError(`wallet webhook: unresolved payload "${event.payload}" (payment ${event.paymentId})`)
          return reply.code(200).send({ ok: true })
        }
        const amount = usdtToMicro(event.amount)
        try {
          await deps.insertLedgerEntry({
            userId,
            type: WalletEntryType.Deposit,
            amount, // positive: a credit
            externalId: event.paymentId,
            status: WalletEntryStatus.Created,
            meta: { invoiceId: event.invoiceId, currency: event.currency },
          })
        }
        catch (err) {
          if ((err as { code?: number }).code === 11000) {
            return reply.code(200).send({ ok: true }) // replay — already credited
          }
          throw err
        }
        await deps.creditBalance(userId, amount)
        await deps.setLedgerStatus(event.paymentId, WalletEntryStatus.Completed)
        return reply.code(200).send({ ok: true })
      }
      catch (err) {
        deps.logError(`wallet webhook failed: ${(err as Error).message}`)
        // Signature was valid but processing failed — 200 stops xRocket retries;
        // the reconciliation worker (Task 11) catches any missed credit.
        return reply.code(200).send({ ok: true })
      }
    })
  }
}
