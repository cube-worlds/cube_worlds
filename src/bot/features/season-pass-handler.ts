import type { RewardsEntryType } from '#root/common/models/RewardsPoolLedger'

// Pure Season Pass payment logic, decoupled from grammY's Context so it can be
// unit-tested directly. The composer (season-pass.ts) adapts ctx to these calls.

export interface SeasonPassPayment {
  telegramPaymentChargeId: string
  invoicePayload: string
  // Telegram subscription expiry, unix seconds (present for recurring subs).
  subscriptionExpirationDate?: number
}

export interface SeasonPassHandlerDependencies {
  parsePayload: (payload: string) => number | null
  grantSeasonPass: (input: { userId: number, telegramPaymentChargeId: string, activeUntil?: Date }) => Promise<void>
  accrueRewards: (entry: { type: RewardsEntryType, amount: bigint, externalId: string, meta?: Record<string, unknown> }) => Promise<void>
  accrueShare: (amountMicro: bigint) => bigint
  seasonPassRevenueMicro: () => bigint
  accrualType: RewardsEntryType
  logError: (message: string) => void
}

// Parse the `seasonpass:<userId>` invoice payload into a positive integer id.
export function parseSeasonPassPayload(payload: string): number | null {
  const match = /^seasonpass:(\d+)$/.exec(payload)
  if (!match)
    return null
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

export function buildSeasonPassHandlers(deps: SeasonPassHandlerDependencies) {
  // pre_checkout_query: approve only a well-formed Season Pass payload. Telegram
  // requires an answer within 10 s.
  async function handlePreCheckout(invoicePayload: string): Promise<{ ok: boolean, error?: string }> {
    const userId = deps.parsePayload(invoicePayload)
    if (userId === null)
      return { ok: false, error: 'Invalid purchase' }
    return { ok: true }
  }

  // successful_payment: grant/extend the pass (idempotent on the charge id) and
  // accrue the rewards-pool share. Returns a confirmation message, or null if the
  // payload was unparseable.
  async function handleSuccessfulPayment(payment: SeasonPassPayment): Promise<string | null> {
    const userId = deps.parsePayload(payment.invoicePayload)
    if (userId === null) {
      deps.logError(`season-pass payment with bad payload: ${payment.invoicePayload}`)
      return null
    }
    const activeUntil = payment.subscriptionExpirationDate
      ? new Date(payment.subscriptionExpirationDate * 1000)
      : undefined
    await deps.grantSeasonPass({
      userId,
      telegramPaymentChargeId: payment.telegramPaymentChargeId,
      activeUntil,
    })
    try {
      await deps.accrueRewards({
        type: deps.accrualType,
        amount: deps.accrueShare(deps.seasonPassRevenueMicro()),
        externalId: `accrual:sp:${payment.telegramPaymentChargeId}`,
      })
    }
    catch (err) {
      deps.logError(`rewards accrual failed for season-pass ${payment.telegramPaymentChargeId}: ${(err as Error).message}`)
    }
    return '✨ Season Pass active! Your energy cap is raised and you get a free weekly tournament entry.'
  }

  return { handlePreCheckout, handleSuccessfulPayment }
}
