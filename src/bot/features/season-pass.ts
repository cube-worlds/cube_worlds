import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { accrueShare } from '#root/common/helpers/rewards'
import { usdtToMicro } from '#root/common/helpers/wallet'
import { accrueRewards, RewardsEntryType  } from '#root/common/models/RewardsPoolLedger'
import { grantSeasonPass } from '#root/common/models/SeasonPass'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { buildSeasonPassHandlers, parseSeasonPassPayload } from './season-pass-handler'

const handlers = buildSeasonPassHandlers({
  parsePayload: parseSeasonPassPayload,
  grantSeasonPass,
  accrueRewards,
  accrueShare,
  seasonPassRevenueMicro: () => usdtToMicro(config.SEASON_PASS_REVENUE_USDT),
  accrualType: RewardsEntryType.AccrualSeasonPass,
  logError: logger.error.bind(logger),
})

const composer = new Composer<Context>()

composer.on('pre_checkout_query', async (ctx) => {
  const result = await handlers.handlePreCheckout(ctx.preCheckoutQuery.invoice_payload)
  await ctx.answerPreCheckoutQuery(result.ok, result.error ? { error_message: result.error } : undefined)
})

composer.on('message:successful_payment', async (ctx) => {
  const sp = ctx.message.successful_payment
  const text = await handlers.handleSuccessfulPayment({
    telegramPaymentChargeId: sp.telegram_payment_charge_id,
    invoicePayload: sp.invoice_payload,
    subscriptionExpirationDate: sp.subscription_expiration_date,
  })
  if (text)
    await ctx.reply(text)
})

export { composer as seasonPassFeature }
