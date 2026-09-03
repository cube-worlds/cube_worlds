import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { logHandle } from '#root/common/helpers/logging'
import { BalanceChangeType } from '#root/common/models/Balance'
import { recordStarsPurchase } from '#root/common/models/StarsPurchase'
import { addPoints } from '#root/common/models/User'
import { logger } from '#root/logger'
import { buildTopupPaymentHandler, parseTopupPayload } from './topup-handler'

const composer = new Composer<Context>()

composer.on(
  'pre_checkout_query',
  logHandle('topup-pre-checkout'),
  async (ctx) => {
    const ok = parseTopupPayload(ctx.preCheckoutQuery.invoice_payload) !== null
    if (ok) {
      await ctx.answerPreCheckoutQuery(true)
    } else {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Invalid top-up request. Please try again from the app.',
      })
    }
  },
)

composer.on(
  'message:successful_payment',
  logHandle('topup-successful-payment'),
  async (ctx) => {
    const payment = ctx.message.successful_payment
    const handle = buildTopupPaymentHandler({
      record: recordStarsPurchase,
      credit: async (userId, votes) => {
        await addPoints(userId, votes, BalanceChangeType.StarsTopup)
      },
      notifyUser: async (userId, votes) => {
        await ctx.api.sendMessage(
          userId,
          `⭐️ Top-up complete: +${votes} $CUBE`,
        )
      },
      logError: (message) => logger.error(message),
    })
    const result = await handle(
      payment.invoice_payload,
      payment.telegram_payment_charge_id,
    )
    if (!result.ok && result.reason !== 'duplicate') {
      logger.error(
        `Stars top-up failed (${result.reason}) for payload "${payment.invoice_payload}"`,
      )
    }
  },
)

export { composer as topupFeature }
