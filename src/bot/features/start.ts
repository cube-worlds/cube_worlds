import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import { Composer } from 'grammy'
import { logHandle } from '#root/common/helpers/logging'
import { findUserById } from '#root/common/models/User'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

export interface CheckReferalDependencies {
  findUserById: (id: number) => Promise<UserDoc | null>
}

export function buildCheckReferal(
  deps: CheckReferalDependencies = { findUserById },
) {
  return async function checkReferal(ctx: Context) {
    const payload = ctx.match
    if (payload) {
      if (ctx.dbuser.wallet || ctx.dbuser.referalId) {
        return
      }
      const receiverId = Number(payload)
      const receiver = await deps.findUserById(receiverId)
      if (!receiver) {
        return ctx.reply(ctx.t('vote.no_receiver'))
      }
      if (receiverId === ctx.dbuser.id) {
        return ctx.reply(ctx.t('vote.self_vote'))
      }
      ctx.dbuser.referalId = receiverId
      await ctx.dbuser.save()
    }
  }
}

export interface StartCommandDependencies {
  checkReferal: (ctx: Context) => Promise<unknown>
}

export function buildStartCommandHandler(
  deps: StartCommandDependencies = { checkReferal: buildCheckReferal() },
) {
  return async function startCommand(ctx: Context) {
    await ctx.reply(ctx.t('start'), {
      link_preview_options: { is_disabled: true },
    })
    await deps.checkReferal(ctx)
  }
}

feature.command(
  'start',
  logHandle('command-start'),
  buildStartCommandHandler(),
)

export { composer as startFeature }
