import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/index'
import { setCommandsHandler } from '#root/bot/handlers/index'
import { logHandle } from '#root/common/helpers/logging'
import { chatAction } from '@grammyjs/auto-chat-action'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command(
  'setcommands',
  logHandle('command-setcommands'),
  chatAction('typing'),
  setCommandsHandler,
)

export { composer as adminFeature }
