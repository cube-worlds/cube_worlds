import type { Context, SessionData } from '#root/bot/context'
import type { BotConfig, StorageAdapter } from 'grammy'
import { createContextConstructor } from '#root/bot/context'
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
} from '#root/bot/features/index'
import { errorHandler } from '#root/bot/handlers/index'
import { queueMenu } from '#root/bot/keyboards/queue-menu'
import attachUser from '#root/bot/middlewares/attach-user'
import { updateLogger } from '#root/bot/middlewares/index'
import { i18n, isMultipleLocales } from '#root/common/i18n'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { autoRetry } from '@grammyjs/auto-retry'
import { hydrate } from '@grammyjs/hydrate'
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
  bot.api.config.use(autoRetry())

  if (config.isDev) {
    protectedBot.use(updateLogger())
  }

  protectedBot.use(autoChatAction(bot.api))
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
