import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { tonToPoints } from '#root/common/helpers/points'
import {
  sendMessageToAdmins,
  sendPlaceInLine,
} from '#root/common/helpers/telegram'
import { BalanceChangeType } from '#root/common/models/Balance'
import { findTransaction } from '#root/common/models/Transaction'
import { addPoints, findUserByName } from '#root/common/models/User'
import { fromNano } from '@ton/core'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command(
  'transaction',
  logHandle('command-transaction'),
  async (ctx) => {
    const argument = ctx.match.trim()
    if (argument) {
      const [hash, lt, username] = argument.split(' ')
      const numberLt = Number(lt)

      const trx = await findTransaction(numberLt, hash)
      if (!trx) {
        return ctx.reply(
          `Transaction with hash \`${hash}\` and lt \`${numberLt}\` not found`,
        )
      }

      if (trx.accepted) {
        return ctx.reply('Transaction is already accepted!')
      }

      if (!username) {
        return ctx.reply('Username is empty!')
      }

      const user = await findUserByName(username.replace(/^@/, ''))
      if (!user) {
        return ctx.reply(`User ${username} not found`)
      }

      // save tx accepted
      trx.accepted = true
      await trx.save()

      // add points to user balance
      const ton = fromNano(trx.coins)
      const points = tonToPoints(Number(ton))
      await addPoints(user.id, points, BalanceChangeType.Donation)

      // send messages
      await sendPlaceInLine(ctx.api, user.id, true)
      await sendMessageToAdmins(
        ctx.api,
        `⚡️ FOUND TX OF @${user.name} FOR ${ton} TON. Minted: ${user.minted ? '✅' : '❌'}`,
      )
    } else {
      return ctx.reply('`/transaction` hash lt username')
    }
  },
)

export { composer as transactionFeature }
