import type { Context } from '#root/bot/context'
import { changeLanguageData } from '#root/bot/callback-data/index'
import { chunk } from '#root/common/helpers/keyboard'
import { i18n } from '#root/common/i18n'
import { InlineKeyboard } from 'grammy'
import ISO6391 from 'iso-639-1'

export function createChangeLanguageKeyboard(ctx: Context) {
    const currentLocaleCode = ctx.dbuser.language

    const getLabel = (code: string) => {
        const isActive = code === currentLocaleCode

        return `${isActive ? '✅ ' : ''}${ISO6391.getNativeName(code)}`
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
