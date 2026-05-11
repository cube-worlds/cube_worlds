import type { Context } from '#root/bot/context'
import { voteScore } from '#root/common/helpers/votes'
import { UserState } from '#root/common/models/User'

export interface ResetHandlerDependencies {
  voteScore: (ctx: Context) => Promise<number>
}

function createDefaultDependencies(): ResetHandlerDependencies {
  return { voteScore }
}

export function buildResetCommandHandler(
  deps: ResetHandlerDependencies = createDefaultDependencies(),
) {
  return async function handleReset(ctx: Context) {
    ctx.dbuser.state = UserState.WaitNothing
    if (!ctx.dbuser.votes) {
      ctx.dbuser.votes = BigInt(await deps.voteScore(ctx))
    }
    await ctx.dbuser.save()
    await ctx.reply(ctx.t('reset'))
  }
}
