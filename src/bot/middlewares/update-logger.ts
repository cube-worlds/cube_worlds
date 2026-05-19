import type { MiddlewareFn } from 'grammy'
import type { Context } from '#root/bot/context'
import { performance } from 'node:perf_hooks'
import { getUpdateInfo } from '#root/common/helpers/logging'

export function updateLogger(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    ctx.api.config.use((previous, method, payload, signal) => {
      ctx.logger.debug({
        msg: 'bot api call',
        method,
        payload,
      })

      return previous(method, payload, signal)
    })

    ctx.logger.debug({
      msg: 'update received',
      update: getUpdateInfo(ctx),
    })

    const startTime = performance.now()
    try {
      await next()
    } finally {
      const endTime = performance.now()
      ctx.logger.debug({
        msg: 'update processed',
        duration: endTime - startTime,
      })
    }
  }
}
