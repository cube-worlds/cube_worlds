import type { Context } from '#root/bot/context.js'
import { changeLanguageData } from '#root/bot/callback-data/index.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { i18n } from '#root/bot/i18n.js'
import { createChangeLanguageKeyboard } from '#root/bot/keyboards/index.js'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('language', logHandle('command-language'), async (ctx) => {
  return ctx.reply(ctx.t('language.select'), {
    reply_markup: createChangeLanguageKeyboard(ctx),
  })
})

feature.callbackQuery(
  changeLanguageData.filter(),
  logHandle('keyboard-language-select'),
  async (ctx: Context) => {
    const { code: languageCode } = changeLanguageData.unpack(ctx.callbackQuery?.data ?? '')

    if (i18n.locales.includes(languageCode)) {
      await ctx.i18n.setLocale(languageCode)
      ctx.dbuser.language = languageCode
      await ctx.dbuser.save()

      return ctx.editMessageText(ctx.t('language.changed'), {
        reply_markup: createChangeLanguageKeyboard(ctx),
      })
    }
  },
)

export { composer as languageFeature }
