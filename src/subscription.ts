import type { Context } from '#root/bot/context'
import type { Api, Bot, RawApi } from 'grammy'
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
import { Address, beginCell, fromNano, toNano } from '@ton/core'
import TonWeb from 'tonweb'
import { convertCubeToSatoshi, getSatoshiWalletAddress } from './common/helpers/satoshi'

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

        if ((typeof message === 'string') && message.startsWith('s:')) {
            const votesRequested = Number.parseInt(message.slice(2), 10)
            if (user.votes < votesRequested) {
                await this.bot.api.sendMessage(user.id, ' You have\'nt sufficient $CUBES to exchange for $SATOSHI points.')
                return
            }
            const decreasedBalance = await addPoints(user.id, -points, BalanceChangeType.Donation)
            logger.info(`User ${user.id} new balance: ${decreasedBalance} points after trade ${points} for $SATOSHI`)
            const userAddress = senderAddress.toRawString()
            const satoshiToSend = await convertCubeToSatoshi(this.tonweb, config.isDev, votesRequested)
            logger.info(`Send ${satoshiToSend} satoshi to ${userAddress}`)
            await this.sendJetton(userAddress, BigInt(satoshiToSend))
            await this.bot.api.sendMessage(
                user.id,
                `Successfully exchanged ${votesRequested} $CUBES for ${satoshiToSend} $SATOSHI!`,
            )
        } else {
            await addPoints(user.id, points, BalanceChangeType.Donation)

            await this.bot.api.sendMessage(user.id, i18n.t(user.language, 'donation', { ton }))

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
            this.tonweb,
            config.COLLECTION_OWNER,
            startTime,
            this.onTransaction,
        )
        await accountSubscription.start()
    }

    private async sendJetton(
        toAddress: string,
        amount: bigint,
    ): Promise<void> {
        try {
            const satoshiWalletAddress = await getSatoshiWalletAddress(config.isDev)
            const jettonWalletAddress = Address.parse(satoshiWalletAddress)
            const destinationAddress = Address.parse(toAddress)
            const responseDestinationAddress = Address.parse(config.COLLECTION_OWNER)

            const transferBody = beginCell()
                .storeUint(0xF8A7EA5, 32) // operation code for transfer
                .storeUint(0, 64) // query id
                .storeCoins(amount)
                .storeAddress(destinationAddress)
                .storeAddress(responseDestinationAddress) // response destination
                .storeBit(0) // no custom payload
                .storeCoins(toNano('0.05')) // forward amount for notification
                .storeBit(0) // no forward payload
                .endCell()

            logger.info(`Sending ${amount} jettons to ${toAddress}`)

            // Serialize and send the message
            const bocCell = beginCell()
                .storeUint(0x10, 6) // Internal message, IHR disabled
                .storeUint(0, 3) // Bounce, bounced, src present
                .storeAddress(jettonWalletAddress)
                .storeCoins(toNano('0.1')) // gas fee
                .storeUint(0, 1) // No init code
                .storeRef(transferBody)
                .endCell()

            const boc = bocCell.toBoc().toString('base64')

            // Send via TonWeb
            await this.tonweb.provider.sendBoc(boc)

            logger.info(`Jetton transfer initiated successfully to ${toAddress}`)
        } catch (error) {
            logger.error(`Failed to send jetton: ${error}`)
            throw error
        }
    }
}
