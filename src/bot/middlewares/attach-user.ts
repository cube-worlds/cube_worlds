import type { NextFunction } from 'grammy'
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import { i18n } from '#root/common/i18n'
import { findOrCreateUser } from '#root/common/models/User'

export interface AttachUserDependencies {
  findOrCreateUser: (id: number) => Promise<UserDoc | null>
  supportedLocales: readonly string[]
}

function createDefaultDependencies(): AttachUserDependencies {
  return {
    findOrCreateUser,
    supportedLocales: i18n.locales,
  }
}

export function buildAttachUser(
  deps: AttachUserDependencies = createDefaultDependencies(),
) {
  return async function attachUser(ctx: Context, next: NextFunction) {
    if (!ctx.from) {
      throw new Error('No from field found')
    }
    const user = await deps.findOrCreateUser(ctx.from.id)
    if (!user) {
      throw new Error('User not found')
    }
    ctx.dbuser = user
    if (!ctx.dbuser.languageSelected || !ctx.dbuser.language) {
      const locale = await ctx.i18n.getLocale()
      const localeSupported = deps.supportedLocales.includes(locale)
      ctx.dbuser.language = localeSupported ? locale : 'en'
      ctx.dbuser.languageSelected = true
      await ctx.dbuser.save()
    }
    if (ctx.dbuser.language) {
      await ctx.i18n.setLocale(ctx.dbuser.language)
    }
    return next()
  }
}

export default buildAttachUser()
