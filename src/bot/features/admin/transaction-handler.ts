import type { Context } from '#root/bot/context'
import type { Transaction } from '#root/common/models/Transaction'
import type { UserDoc } from '#root/common/models/User'
import type { Api, RawApi } from 'grammy'
import { tonToPoints } from '#root/common/helpers/points'
import {
  sendMessageToAdmins,
  sendPlaceInLine,
} from '#root/common/helpers/telegram'
import { BalanceChangeType } from '#root/common/models/Balance'
import { findTransaction } from '#root/common/models/Transaction'
import { addPoints, findUserByName } from '#root/common/models/User'
import { fromNano } from '@ton/core'

export interface TransactionAcceptedTx {
  accepted?: boolean
  coins: number
  save: () => Promise<void>
}

export interface TransactionHandlerDependencies {
  findTransaction: (lt: number, hash: string) => Promise<Transaction & TransactionAcceptedTx | null>
  findUserByName: (name: string) => Promise<UserDoc | null>
  addPoints: (
    userId: number,
    amount: bigint,
    type: BalanceChangeType,
  ) => Promise<unknown>
  sendPlaceInLine: (
    api: Api<RawApi>,
    userId: number,
    success: boolean,
  ) => Promise<unknown>
  sendMessageToAdmins: (api: Api<RawApi>, text: string) => Promise<unknown>
}

function createDefaultDependencies(): TransactionHandlerDependencies {
  return {
    findTransaction: findTransaction as TransactionHandlerDependencies['findTransaction'],
    findUserByName,
    addPoints,
    sendPlaceInLine,
    sendMessageToAdmins,
  }
}

export function buildTransactionCommandHandler(
  deps: TransactionHandlerDependencies = createDefaultDependencies(),
) {
  return async function handleTransaction(ctx: Context) {
    const rawMatch = typeof ctx.match === 'string' ? ctx.match : ''
    const argument = rawMatch.trim()
    if (!argument) {
      return ctx.reply('`/transaction` hash lt username')
    }

    const [hash, lt, username] = argument.split(' ')
    const numberLt = Number(lt)

    const trx = await deps.findTransaction(numberLt, hash)
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

    const user = await deps.findUserByName(username.replace(/^@/, ''))
    if (!user) {
      return ctx.reply(`User ${username} not found`)
    }

    trx.accepted = true
    await trx.save()

    const ton = fromNano(trx.coins)
    const points = tonToPoints(Number(ton))
    await deps.addPoints(user.id, points, BalanceChangeType.Donation)

    await deps.sendPlaceInLine(ctx.api, user.id, true)
    await deps.sendMessageToAdmins(
      ctx.api,
      `⚡️ FOUND TX OF @${user.name} FOR ${ton} TON. Minted: ${user.minted ? '✅' : '❌'}`,
    )
  }
}
