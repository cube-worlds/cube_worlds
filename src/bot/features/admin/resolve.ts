import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { windowIdAt } from '#root/game/places'
import { createResolver } from '#root/game/resolver-start'

const composer = new Composer<Context>()
const feature = composer.chatType('private').filter(isAdmin)

function canForceLiveWindow(): boolean {
  return config.isDev || new URL(config.WEB_APP_URL).host.startsWith('staging.')
}

feature.command('resolve', logHandle('command-resolve'), async (ctx) => {
  const resolver = createResolver(ctx.api)
  await resolver.tick()
  if (!canForceLiveWindow()) {
    return ctx.reply('Past windows resolved. The live window closes on schedule (production).')
  }
  const paid = await resolver.resolveWindow(windowIdAt(Date.now()))
  return ctx.reply(`Forced current window: ${paid} visit(s) paid.`)
})

export { composer as resolveFeature }
