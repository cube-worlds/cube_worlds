import type { Context } from '#root/bot/context'
import { InlineKeyboard } from 'grammy'

export interface HelpHandlerDependencies {
  webAppUrl: string
}

export function buildHelpCommandHandler(deps: HelpHandlerDependencies) {
  return async function helpCommand(ctx: Context) {
    await ctx.reply(ctx.t('help.message'), {
      reply_markup: new InlineKeyboard().webApp(
        ctx.t('menu_button.label'),
        deps.webAppUrl,
      ),
    })
  }
}
