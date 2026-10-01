import type { Update } from '@grammyjs/types'
import type { MiddlewareFn } from 'grammy'
import type { Context } from '#root/bot/context'
import { trackEvent } from '#root/common/helpers/umami'

export function getUpdateInfo(ctx: Context): Omit<Update, 'update_id'> {
  const { update_id, ...update } = ctx.update
  return update
}

export function logHandle(id: string): MiddlewareFn<Context> {
  return (ctx, next) => {
    ctx.logger.info({
      msg: `handle ${id}`,
      ...(id.startsWith('unhandled') ? { update: getUpdateInfo(ctx) } : {}),
    })
    trackEvent(id, ctx.from?.id)

    return next()
  }
}
