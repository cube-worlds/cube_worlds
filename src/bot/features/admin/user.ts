import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { buildUserCommandHandler } from '#root/bot/features/admin/user-handler'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('user', logHandle('command-user'), buildUserCommandHandler())

export { composer as userFeature }
