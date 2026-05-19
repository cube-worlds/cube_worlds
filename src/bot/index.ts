import type { Context, SessionData } from '#root/bot/context'
import type { BotConfig, StorageAdapter } from 'grammy'
import { createContextConstructor } from '#root/bot/context'
import {
  collectionFeature,
  helpFeature,
  lineFeature,
  parametersFeature,
  queueFeature,
  removedCommandsFeature,
  startFeature,
  statsFeature,
  transactionFeature,
  unhandledFeature,
  whalesFeature,
} from '#root/bot/features/index'
import { errorHandler } from '#root/bot/handlers/index'
import { queueMenu } from '#root/bot/keyboards/queue-menu'
import attachUser from '#root/bot/middlewares/attach-user'
import { updateLogger } from '#root/bot/middlewares/index'
import { i18n } from '#root/common/i18n'
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
  protectedBot.use(helpFeature)
  protectedBot.use(queueFeature)
  protectedBot.use(parametersFeature)
  protectedBot.use(collectionFeature)
  protectedBot.use(statsFeature)
  protectedBot.use(whalesFeature)
  protectedBot.use(lineFeature)
  protectedBot.use(transactionFeature)
  protectedBot.use(userFeature)

  // catches deleted commands; must be after all kept features
  protectedBot.use(removedCommandsFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
