import type { Context } from '#root/bot/context'
import { logHandle } from '#root/common/helpers/logging'
import { voteScore } from '#root/common/helpers/votes'
import { UserState } from '#root/common/models/User'
import { Composer } from 'grammy'
import { checkNotMinted } from '../middlewares/check-not-minted'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('reset', checkNotMinted(), logHandle('command-reset'), async (ctx) => {
    ctx.dbuser.state = UserState.WaitNothing
    if (!ctx.dbuser.votes) {
        ctx.dbuser.votes = BigInt(await voteScore(ctx))
    }
    await ctx.dbuser.save()
    await ctx.reply(ctx.t('reset'))
})

export { composer as resetFeature }
