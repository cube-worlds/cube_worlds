import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { buildHelpCommandHandler } from '#root/bot/features/help-handler'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(
  'help',
  logHandle('command-help'),
  buildHelpCommandHandler({ webAppUrl: config.WEB_APP_URL }),
)

export { composer as helpFeature }
