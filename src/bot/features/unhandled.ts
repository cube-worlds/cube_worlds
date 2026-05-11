import type { Context } from '#root/bot/context'
import { logHandle } from '#root/common/helpers/logging'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

export function handleUnhandledMessage(ctx: Context) {
  return ctx.reply(ctx.t('unhandled'))
}

export function handleUnhandledCallbackQuery(ctx: Context) {
  return ctx.answerCallbackQuery()
}

feature.on('message', logHandle('unhandled-message'), handleUnhandledMessage)
feature.on(
  'callback_query',
  logHandle('unhandled-callback-query'),
  handleUnhandledCallbackQuery,
)

export { composer as unhandledFeature }
