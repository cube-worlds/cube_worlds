import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import { findUserByName } from '#root/common/models/User'

export interface UserHandlerDependencies {
  findUserByName: (name: string) => Promise<UserDoc | null>
}

function createDefaultDependencies(): UserHandlerDependencies {
  return { findUserByName }
}

export function buildUserCommandHandler(
  deps: UserHandlerDependencies = createDefaultDependencies(),
) {
  return async function handleUser(ctx: Context) {
    const rawMatch = typeof ctx.match === 'string' ? ctx.match : ''
    const username = rawMatch.trim()
    if (username) {
      const user = await deps.findUserByName(username.replace(/^@/, ''))
      if (!user) return ctx.reply(`User ${username} not found`)
      return ctx.reply(user.toString())
    }
    return ctx.reply('/user [username]')
  }
}
