import type { Context } from '#root/bot/context.js'
import type { NextFunction } from 'grammy'
import { i18n } from '#root/bot/i18n.js'
import { createChangeLanguageKeyboard } from '#root/bot/keyboards/change-language.js'
import { findOrCreateUser } from '#root/bot/models/user.js'

export default async function attachUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) {
    throw new Error('No from field found')
  }
  const user = await findOrCreateUser(ctx.from.id)
  if (!user) {
    throw new Error('User not found')
  }
  ctx.dbuser = user
  if (!ctx.dbuser.languageSelected || !ctx.dbuser.language) {
    const locale = await ctx.i18n.getLocale()
    const localeSupported = i18n.locales.includes(locale)
    if (!localeSupported) {
      await ctx.reply(ctx.t('language.select'), {
        reply_markup: createChangeLanguageKeyboard(ctx),
      })
    }
    ctx.dbuser.language = localeSupported ? locale : 'en'
    ctx.dbuser.languageSelected = true
    await ctx.dbuser.save()
  }
  if (ctx.dbuser.language) {
    await ctx.i18n.setLocale(ctx.dbuser.language)
  }
  return next()
}
