import type { Api } from 'grammy'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildSeasonPassInvoiceHandler } from './season-pass-invoice-handler'

// 30 days — the only subscription period Telegram Stars currently allows.
const STARS_SUBSCRIPTION_PERIOD = 2_592_000

// Built with the live bot Api (Stars invoices must be created through the bot),
// so server.ts wires this with `bot.api`. This module imports config, so nothing
// a test imports may import it.
export function createSeasonPassInvoiceHandler(api: Api) {
  return buildSeasonPassInvoiceHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    createStarsInvoiceLink: ({ userId }) =>
      api.createInvoiceLink(
        'Cube Worlds Season Pass',
        'Higher energy cap + a free weekly tournament entry. Renews every 30 days.',
        `seasonpass:${userId}`,
        '', // provider_token MUST be empty for Telegram Stars
        'XTR',
        [{ label: 'Season Pass', amount: config.SEASON_PASS_STARS }],
        { subscription_period: STARS_SUBSCRIPTION_PERIOD },
      ),
    logError: logger.error.bind(logger),
  })
}
