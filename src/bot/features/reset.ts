import type { Context } from '#root/bot/context'
import { buildResetCommandHandler } from '#root/bot/features/reset-handler'
import { logHandle } from '#root/common/helpers/logging'
import { Composer } from 'grammy'
import { checkNotMinted } from '../middlewares/check-not-minted'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(
  'reset',
  checkNotMinted(),
  logHandle('command-reset'),
  buildResetCommandHandler(),
)

export { composer as resetFeature }
