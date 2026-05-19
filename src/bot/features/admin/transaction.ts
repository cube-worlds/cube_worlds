import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { buildTransactionCommandHandler } from '#root/bot/features/admin/transaction-handler'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command(
  'transaction',
  logHandle('command-transaction'),
  buildTransactionCommandHandler(),
)

export { composer as transactionFeature }
