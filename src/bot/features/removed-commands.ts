import type { Context } from '#root/bot/context'
import { buildRemovedCommandsHandler } from '#root/bot/features/removed-commands-handler'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

const handle = buildRemovedCommandsHandler({ webAppUrl: config.WEB_APP_URL })

feature.on('message:text', logHandle('removed-command'), async (ctx, next) => {
  const text = ctx.message?.text ?? ''
  if (text.startsWith('/')) {
    return handle(ctx)
  }
  return next()
})

export { composer as removedCommandsFeature }
