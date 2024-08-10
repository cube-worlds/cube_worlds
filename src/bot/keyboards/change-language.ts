import { InlineKeyboard } from "grammy"
import ISO6391 from "iso-639-1"
import { changeLanguageData } from "#root/bot/callback-data/index.js"
import type { Context } from "#root/bot/context.js"
import { i18n } from "#root/bot/i18n.js"
import { chunk } from "#root/bot/helpers/keyboard.js"

export const createChangeLanguageKeyboard = (ctx: Context) => {
  const currentLocaleCode = ctx.dbuser.language

  const getLabel = (code: string) => {
    const isActive = code === currentLocaleCode

    return `${isActive ? "✅ " : ""}${ISO6391.getNativeName(code)}`
  }

  return InlineKeyboard.from(
    chunk(
      i18n.locales.map(localeCode => ({
        text: getLabel(localeCode),
        callback_data: changeLanguageData.pack({
          code: localeCode,
        }),
      })),
      2,
    ),
  )
}
