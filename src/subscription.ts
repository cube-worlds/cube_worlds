import type { Transaction } from '@ton/core'
import type { Api, Bot, RawApi } from 'grammy'
import type { Context } from '#root/bot/context'
import type { SubscriptionDependencies } from './subscription-core'
import { sendMessageToAdmins } from '#root/common/helpers/telegram'
import { i18n } from '#root/common/i18n'
import {
  findTransaction,
  TransactionModel,
} from '#root/common/models/Transaction'
import { addPoints, findUserByAddress } from '#root/common/models/User'
import { logger } from '#root/logger'
import { processTransaction } from './subscription-core'
import { buildStartProcessTransactions } from './subscription-start'

export {
  processTransaction,
  type SavedTransaction,
  type SubscriptionDependencies,
  type SubscriptionUser,
  type TransactionRecord,
} from './subscription-core'

export function createDefaultSubscriptionDependencies(
  bot: Bot<Context, Api<RawApi>>,
): SubscriptionDependencies {
  return {
    findExistingTransaction: findTransaction,
    saveTransaction: async (record) => {
      const trxModel = new TransactionModel()
      Object.assign(trxModel, record)
      await trxModel.save()
      return {
        markRejected: async () => {
          trxModel.accepted = false
          await trxModel.save()
        },
      }
    },
    findUserByAddress,
    addPoints,
    sendMessage: async (userId, text) => {
      await bot.api.sendMessage(userId, text)
    },
    sendMessageToAdmins: (text) => sendMessageToAdmins(bot.api, text),
    translateDonation: (language, ton) =>
      i18n.t(language, 'donation', { ton }),
    info: (msg) => logger.info(msg),
    error: (msg) => logger.error(msg),
    debug: (msg) => logger.debug(msg),
  }
}

export class Subscription {
  bot: Bot<Context, Api<RawApi>>

  private dependencies: SubscriptionDependencies

  constructor(
    bot: Bot<Context, Api<RawApi>>,
    dependencies?: SubscriptionDependencies,
  ) {
    this.bot = bot
    this.dependencies
      = dependencies ?? createDefaultSubscriptionDependencies(bot)
  }

  onTransaction = async (tx: Transaction): Promise<void> => {
    await processTransaction(tx, this.dependencies)
  }

  public async startProcessTransactions() {
    await buildStartProcessTransactions()(this.onTransaction)
  }
}
