import type { Context } from '#root/bot/context'
import { InlineKeyboard } from 'grammy'

export interface RemovedCommandsHandlerDependencies {
  webAppUrl: string
}

export function buildRemovedCommandsHandler(deps: RemovedCommandsHandlerDependencies) {
  return async function removedCommand(ctx: Context) {
    await ctx.reply(ctx.t('removed_command.message'), {
      reply_markup: new InlineKeyboard().webApp(
        ctx.t('menu_button.label'),
        deps.webAppUrl,
      ),
    })
  }
}
