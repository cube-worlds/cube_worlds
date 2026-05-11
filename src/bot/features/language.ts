import type { Context } from '#root/bot/context'
import type { InlineKeyboard } from 'grammy'
import { changeLanguageData } from '#root/bot/callback-data/index'
import { createChangeLanguageKeyboard } from '#root/bot/keyboards/index'
import { logHandle } from '#root/common/helpers/logging'
import { i18n } from '#root/common/i18n'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

export interface LanguageSelectDependencies {
  supportedLocales: readonly string[]
  unpackLanguageData: (raw: string) => { code: string }
  createKeyboard: (ctx: Context) => InlineKeyboard
}

export function buildHandleLanguageSelect(
  deps: LanguageSelectDependencies = {
    supportedLocales: i18n.locales,
    unpackLanguageData: changeLanguageData.unpack.bind(changeLanguageData),
    createKeyboard: createChangeLanguageKeyboard,
  },
) {
  return async function handleLanguageSelect(ctx: Context) {
    const { code: languageCode } = deps.unpackLanguageData(
      ctx.callbackQuery?.data ?? '',
    )

    if (deps.supportedLocales.includes(languageCode)) {
      await ctx.i18n.setLocale(languageCode)
      ctx.dbuser.language = languageCode
      await ctx.dbuser.save()

      return ctx.editMessageText(ctx.t('language.changed'), {
        reply_markup: deps.createKeyboard(ctx),
      })
    }
  }
}

feature.command('language', logHandle('command-language'), async (ctx) => {
  return ctx.reply(ctx.t('language.select'), {
    reply_markup: createChangeLanguageKeyboard(ctx),
  })
})

feature.callbackQuery(
  changeLanguageData.filter(),
  logHandle('keyboard-language-select'),
  buildHandleLanguageSelect(),
)

export { composer as languageFeature }
