import type { Context } from '#root/bot/context'
import type { ErrorHandler } from 'grammy'
import { getUpdateInfo } from '#root/common/helpers/logging'

export const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error

  ctx.logger.error({
    err: error.error,
    update: getUpdateInfo(ctx),
  })
}
