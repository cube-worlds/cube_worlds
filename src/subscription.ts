import type { Address, Transaction } from '@ton/core'
import type { Api, Bot, RawApi } from 'grammy'
import type { Context } from '#root/bot/context'
import type { OpenedWallet } from './common/helpers/ton'
import type { SubscriptionDependencies } from './subscription-core'
import { beginCell, internal, SendMode, toNano } from '@ton/core'
import { JettonMaster } from '@ton/ton'
import { sendMessageToAdmins } from '#root/common/helpers/telegram'
import { i18n } from '#root/common/i18n'
import {
  findTransaction,
  TransactionModel,
} from '#root/common/models/Transaction'
import { addPoints, findUserByAddress } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import {
  convertCubeToSatoshi,
  getSatoshiJettonMasterAddress,
  getSatoshiWalletAddress,
} from './common/helpers/satoshi'
import { openWallet, tonClient } from './common/helpers/ton'
import { processTransaction } from './subscription-core'
import { buildStartProcessTransactions } from './subscription-start'

export {
  INSUFFICIENT_CUBES_MESSAGE,
  processTransaction,
  type SavedTransaction,
  type SubscriptionDependencies,
  type SubscriptionUser,
  type TransactionRecord,
} from './subscription-core'

async function sendJettonTransfer(
  wallet: OpenedWallet,
  toAddress: Address,
  amount: bigint,
): Promise<number> {
  const mySatoshiJettonWallet = getSatoshiWalletAddress(config.isDev).address
  const satoshiMasterAddress = getSatoshiJettonMasterAddress(config.isDev)
  const jettonMasterContract = new JettonMaster(satoshiMasterAddress.address)

  const recipientJettonWalletAddress
    = await jettonMasterContract.getWalletAddress(
      tonClient.provider(satoshiMasterAddress.address),
      toAddress,
    )

  const seqno = await wallet.contract.getSeqno()

  const value = config.isDev ? toNano('0.1') : toNano('0.04')
  const notifyValue = toNano('0.01')
  const bounce = true

  await wallet.contract.sendTransfer({
    seqno,
    secretKey: wallet.keyPair.secretKey,
    messages: [
      internal({
        to: mySatoshiJettonWallet,
        value,
        bounce,
        body: beginCell()
          .storeUint(0xf8a7ea5, 32) // jetton::transfer
          .storeUint(0, 64) // query_id
          .storeCoins(amount) // jettons
          .storeAddress(recipientJettonWalletAddress) // recipient
          .storeAddress(wallet.contract.address)
          .storeBit(0) // no custom payload
          .storeCoins(notifyValue) // forward TON to recipient
          .storeBit(0)
          .endCell(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  })

  return seqno
}

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
    convertCubeToSatoshi: (votes) => convertCubeToSatoshi(config.isDev, votes),
    sendJetton: async (toAddress, amount) => {
      const wallet = await openWallet(config.MNEMONICS.split(' '))
      await sendJettonTransfer(wallet, toAddress, amount)
    },
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
