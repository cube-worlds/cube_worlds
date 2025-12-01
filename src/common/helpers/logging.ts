import type { Context } from '#root/bot/context'
import type { Update } from '@grammyjs/types'
import type { Middleware } from 'grammy'

export function getUpdateInfo(ctx: Context): Omit<Update, 'update_id'> {
    const { update_id, ...update } = ctx.update
    return update
}

export function logHandle(id: string): Middleware<Context> {
    return (ctx, next) => {
        ctx.logger.info({
            msg: `handle ${id}`,
            ...(id.startsWith('unhandled') ? { update: getUpdateInfo(ctx) } : {}),
        })

        return next()
    }
}
