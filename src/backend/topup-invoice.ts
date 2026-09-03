import type { Api } from 'grammy'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildTopupInvoiceHandler } from './topup-invoice-handler'

export function createTopupInvoiceHandler(api: Api) {
  return buildTopupInvoiceHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    votesPerStar: () => BigInt(config.STARS_TOPUP_VOTES_PER_STAR),
    createInvoiceLink: ({ title, description, payload, stars }) =>
      // Telegram Stars: empty provider_token, currency XTR, amount in Stars.
      api.createInvoiceLink(title, description, payload, '', 'XTR', [
        { label: title, amount: stars },
      ]),
    logError: (message) => logger.error(message),
  })
}
