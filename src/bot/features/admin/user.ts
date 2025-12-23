import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { findUserByName } from '#root/common/models/User'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('user', logHandle('command-user'), async (ctx) => {
  const username = ctx.match.trim()
  if (username) {
    const user = await findUserByName(username.replace(/^@/, ''))
    if (!user) return ctx.reply(`User ${username} not found`)
    return ctx.reply(user.toString())
  }
  return ctx.reply('/user [username]')
})

export { composer as userFeature }
