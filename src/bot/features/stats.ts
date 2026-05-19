import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { buildStatsCommandHandler } from '#root/bot/features/stats-handler'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command(
  'stats',
  logHandle('command-stats'),
  buildStatsCommandHandler(),
)

export { composer as statsFeature }
