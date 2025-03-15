import type { Context, SessionData } from '#root/bot/context.js'
import type { BotConfig, StorageAdapter } from 'grammy'
import { createContextConstructor } from '#root/bot/context.js'
import {
  accountsFeature,
  addressesFeature,
  adminFeature,
  balanceFeature,
  collectionFeature,
  diceFeature,
  languageFeature,
  lineFeature,
  mintFeature,
  parametersFeature,
  playFeature,
  queueFeature,
  resetFeature,
  startFeature,
  statsFeature,
  topupFeature,
  transactionFeature,
  unhandledFeature,
  webappFeature,
  whalesFeature,
} from '#root/bot/features/index.js'
import { errorHandler } from '#root/bot/handlers/index.js'
import { i18n, isMultipleLocales } from '#root/bot/i18n.js'
import { queueMenu } from '#root/bot/keyboards/queue-menu.js'
import attachUser from '#root/bot/middlewares/attach-user.js'
import { updateLogger } from '#root/bot/middlewares/index.js'
import { config } from '#root/config.js'
import { logger } from '#root/logger.js'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { autoRetry } from '@grammyjs/auto-retry'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { session, Bot as TelegramBot } from 'grammy'
import { userFeature } from './features/admin/user'
import slapReaction from './middlewares/reaction'

interface Options {
  sessionStorage?: StorageAdapter<SessionData>
  config?: Omit<BotConfig<Context>, 'ContextConstructor'>
}

export function createBot(token: string, options: Options) {
  const { sessionStorage } = options
  const bot = new TelegramBot(token, {
    ...options.config,
    ContextConstructor: createContextConstructor({ logger }),
  })
  const protectedBot = bot.errorBoundary(errorHandler)

  // Middlewares
  bot.api.config.use(parseMode('HTML'))
  bot.api.config.use(autoRetry())

  if (config.isDev) {
    protectedBot.use(updateLogger())
  }

  protectedBot.use(autoChatAction(bot.api))
  protectedBot.use(hydrateReply)
  protectedBot.use(hydrate())
  protectedBot.use(
    session({
      initial: () => ({}),
      storage: sessionStorage,
    }),
  )
  protectedBot.use(slapReaction)
  protectedBot.use(i18n)
  protectedBot.use(attachUser)
  protectedBot.use(queueMenu)

  // Handlers
  protectedBot.use(startFeature)
  protectedBot.use(resetFeature)
  protectedBot.use(mintFeature)
  protectedBot.use(diceFeature)
  protectedBot.use(queueFeature)
  protectedBot.use(parametersFeature)
  protectedBot.use(collectionFeature)
  protectedBot.use(topupFeature)
  protectedBot.use(adminFeature)
  protectedBot.use(statsFeature)
  protectedBot.use(whalesFeature)
  protectedBot.use(lineFeature)
  protectedBot.use(webappFeature)
  protectedBot.use(transactionFeature)
  protectedBot.use(addressesFeature)
  protectedBot.use(playFeature)
  protectedBot.use(balanceFeature)
  protectedBot.use(userFeature)
  protectedBot.use(accountsFeature)

  if (isMultipleLocales) {
    protectedBot.use(languageFeature)
  }

  // must be the last handler
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
