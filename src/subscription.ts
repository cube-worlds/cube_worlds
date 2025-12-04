import type { Context } from '#root/bot/context'
import type { Api, Bot, RawApi } from 'grammy'
import { AccountSubscription } from '#root/common/helpers/account-subscription'
import { tonToPoints } from '#root/common/helpers/points'
import { sendMessageToAdmins, sendPlaceInLine } from '#root/common/helpers/telegram'
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
import { Address, fromNano } from '@ton/core'
import TonWeb from 'tonweb'

export class Subscription {
    bot: Bot<Context, Api<RawApi>>

    tonweb: TonWeb

    constructor(bot: Bot<Context, Api<RawApi>>) {
        this.bot = bot

        this.tonweb = new TonWeb(
            new TonWeb.HttpProvider(
                `https://${config.TESTNET ? 'testnet.' : ''}toncenter.com/api/v2/jsonRPC`,
                { apiKey: config.TONCENTER_API_KEY },
            ),
        )
    }

    onTransaction = async (tx: any) => {
    // It is important to check that Toncoins did not bounce back in case of an error
        if (!tx.in_msg.source || tx.out_msgs.length > 0) {
            return
        }

        const { value, source, message } = tx.in_msg // amount in nano-Toncoins (1 Toncoin = 1e9 nano-Toncoins)
        const { lt, hash } = tx.transaction_id
        const { utime } = tx
        const senderAddress = Address.parse(source)

        // here you find the payment in your database by UUID,
        // check that the payment has not been processed yet and the amount matches,
        // save to the database that this payment has been processed.
        const trx = await findTransaction(lt, hash)
        if (trx) {
            logger.debug(`Exists ${TonWeb.utils.fromNano(value)} TON from ${senderAddress}`)
            return
        }

        const ton = Number(fromNano(value))

        const trxModel = new TransactionModel()
        trxModel.utime = utime
        trxModel.lt = lt
        trxModel.address = senderAddress.toString()
        trxModel.coins = value
        trxModel.ton = ton
        trxModel.hash = hash
        trxModel.accepted = true
        await trxModel.save()
        logger.info(`Receive ${TonWeb.utils.fromNano(value)} TON from ${senderAddress.toString()}"`)

        const points = tonToPoints(ton)
        logger.info(`Received ${ton} TON => ${points} points`)

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

        await addPoints(user.id, points, BalanceChangeType.Donation)

        await this.bot.api.sendMessage(user.id, i18n.t(user.language, 'donation', { ton }))

        await sendPlaceInLine(this.bot.api, user.id, true)
        await sendMessageToAdmins(
            this.bot.api,
            `🚀 RECEIVED ${ton} TON FROM @${user.name}${message ? ` with message "${message}"` : ''}. Minted: ${user.minted ? '✅' : '❌'}`,
        )
    }

    public async startProcessTransactions() {
        const latestTrx = await getLastestTransaction()
        const startTime = latestTrx?.utime ?? 0
        const accountSubscription = new AccountSubscription(
            this.tonweb,
            config.COLLECTION_OWNER,
            startTime,
            this.onTransaction,
        )
        await accountSubscription.start()
    }
}
