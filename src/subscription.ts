import type { Context } from '#root/bot/context'
import type { Address ,
  Transaction} from '@ton/core'
import type { Api, Bot, RawApi } from 'grammy'
import type { OpenedWallet } from './common/helpers/ton'
import { AccountSubscription } from '#root/common/helpers/account-subscription'
import { tonToPoints } from '#root/common/helpers/points'
import { sendMessageToAdmins } from '#root/common/helpers/telegram'
import { i18n } from '#root/common/i18n'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  findTransaction,
  getLastestTransaction,
  TransactionModel,
} from '#root/common/models/Transaction'
import { addPoints, findUserByAddress } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import {
  beginCell,
  fromNano,
  internal,
  SendMode,
  toNano,
} from '@ton/core'
import { JettonMaster } from '@ton/ton'
import { commaSeparatedNumber } from './common/helpers/numbers'
import {
  convertCubeToSatoshi,
  getSatoshiJettonMasterAddress,
  getSatoshiWalletAddress,
} from './common/helpers/satoshi'
import { openWallet, tonClient } from './common/helpers/ton'

interface ParsedInMessage {
  source: Address
  value: bigint
  text: string | undefined
}

function parseInternalInMessage(tx: Transaction): ParsedInMessage | null {
  const inMessage = tx.inMessage
  if (!inMessage || inMessage.info.type !== 'internal') return null

  let text: string | undefined
  try {
    const slice = inMessage.body.beginParse()
    if (slice.remainingBits >= 32) {
      const op = slice.loadUint(32)
      if (op === 0) {
        text = slice.loadStringTail()
      }
    }
  } catch {
    text = undefined
  }

  return {
    source: inMessage.info.src,
    value: inMessage.info.value.coins,
    text,
  }
}

export class Subscription {
  bot: Bot<Context, Api<RawApi>>

  constructor(bot: Bot<Context, Api<RawApi>>) {
    this.bot = bot
  }

  onTransaction = async (tx: Transaction) => {
    // It is important to check that Toncoins did not bounce back in case of an error
    if (tx.outMessagesCount > 0) return
    const parsed = parseInternalInMessage(tx)
    if (!parsed) return

    const { source: senderAddress, value, text: message } = parsed
    const lt = Number(tx.lt)
    const hash = tx.hash().toString('base64')
    const utime = tx.now

    const trx = await findTransaction(lt, hash)
    if (trx) {
      logger.debug(`Exists ${fromNano(value)} TON from ${senderAddress}`)
      return
    }

    const ton = Number(fromNano(value))

    const trxModel = new TransactionModel()
    trxModel.utime = utime
    trxModel.lt = lt
    trxModel.address = senderAddress.toString()
    trxModel.coins = Number(value)
    trxModel.ton = ton
    trxModel.hash = hash
    trxModel.accepted = true
    await trxModel.save()
    logger.info(
      `Receive ${fromNano(value)} TON from ${senderAddress.toString()}"`,
    )

    const points = tonToPoints(ton)

    const user = await findUserByAddress(senderAddress)
    if (!user) {
      trxModel.accepted = false
      await trxModel.save()
      const notFoundMessage = `❗️ USER NOT FOUND FOR: ${ton} TON from ${senderAddress.toString({ bounceable: false })}`
      if (points > 1) {
        await sendMessageToAdmins(this.bot.api, notFoundMessage)
      }
      logger.error(notFoundMessage)
      return
    }

    if (typeof message === 'string' && message.startsWith('s:')) {
      const votesRequested = Number.parseInt(message.slice(2), 10)
      if (user.votes < votesRequested) {
        await this.bot.api.sendMessage(
          user.id,
          " You have'nt sufficient $CUBES to exchange for $SATOSHI points.",
        )
        return
      }
      const decreasedBalance = await addPoints(
        user.id,
        -BigInt(votesRequested),
        BalanceChangeType.Donation,
      )
      const satoshiToSend = await convertCubeToSatoshi(
        config.isDev,
        votesRequested,
      )

      logger.info(
        `User ${user.id} new balance ${decreasedBalance} after trade ${votesRequested} $CUBE for ${fromNano(satoshiToSend)} $SATOSHI`,
      )

      const wallet = await openWallet(config.MNEMONICS.split(' '))
      await this.sendJetton(wallet, senderAddress, BigInt(satoshiToSend))

      await this.bot.api.sendMessage(
        user.id,
        `Successfully exchanged ${commaSeparatedNumber(votesRequested)} $CUBES for ${fromNano(satoshiToSend)} $SATOSHI!`,
      )
    } else {
      await addPoints(user.id, points, BalanceChangeType.Donation)

      await this.bot.api.sendMessage(
        user.id,
        i18n.t(user.language, 'donation', { ton }),
      )

      await sendMessageToAdmins(
        this.bot.api,
        `🚀 RECEIVED ${ton} TON FROM @${user.name}${message ? ` with message "${message}"` : ''}. Minted: ${user.minted ? '✅' : '❌'}`,
      )
    }
  }

  public async startProcessTransactions() {
    const latestTrx = await getLastestTransaction()
    const startTime = latestTrx?.utime ?? 0
    const accountSubscription = new AccountSubscription(
      config.COLLECTION_OWNER,
      startTime,
      this.onTransaction,
    )
    await accountSubscription.start()
  }

  private async sendJetton(
    wallet: OpenedWallet,
    toAddress: Address,
    amount: bigint,
  ): Promise<number> {
    const mySatoshiJettonWallet = getSatoshiWalletAddress(config.isDev).address

    const satoshiMasterAddress = getSatoshiJettonMasterAddress(config.isDev)

    const jettonMasterContract = new JettonMaster(satoshiMasterAddress.address)

    const recipientJettonWalletAddress =
      await jettonMasterContract.getWalletAddress(
        tonClient.provider(satoshiMasterAddress.address),
        toAddress,
      )

    const seqno = await wallet.contract.getSeqno()

    const value = config.isDev ? toNano('0.1') : toNano('0.04')
    const notifyValue = config.isDev ? toNano('0.01') : toNano('0.01')
    const bounce = true // !config.isDev

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
}
