import type { Context } from '#root/bot/context'
import {
  buildBalanceCommandHandler,
  createBalanceHandlerDependencies,
} from '#root/bot/features/balance-handler'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { Composer } from 'grammy'

const composer = new Composer<Context>()
const feature = composer.chatType('private')

feature.command(
  'balance',
  logHandle('command-balance'),
  buildBalanceCommandHandler(createBalanceHandlerDependencies(isAdmin)),
)

export { composer as balanceFeature }
