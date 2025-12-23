import type TonWeb from 'tonweb'
import { sleep } from '#root/common/helpers/time'
import { logger } from '#root/logger'

export class AccountSubscription {
  tonweb: TonWeb

  accountAddress: any

  startTime: any

  onTransaction: any

  constructor(
    tonweb: any,
    accountAddress: any,
    startTime: any,
    onTransaction: any,
  ) {
    this.tonweb = tonweb
    this.accountAddress = accountAddress
    this.startTime = startTime // start unixtime (stored in your database), transactions made earlier will be discarded.
    this.onTransaction = onTransaction
  }

  async start() {
    const getTransactions = async (
      time: undefined,
      offsetTransactionLT: undefined,
      offsetTransactionHash: undefined,
      retryCount: number,
    ) => {
      const COUNT = 10

      if (offsetTransactionLT) {
        logger.debug(
          `Get ${COUNT} transactions before transaction ${offsetTransactionLT}:${offsetTransactionHash}`,
        )
      } else {
        // logger.debug(`Get last ${COUNT} transactions`)
      }

      // TON transaction has composite ID: account address (on which the transaction took place) + transaction LT (logical time) + transaction hash.
      // So TxID = address+LT+hash, these three parameters uniquely identify the transaction.
      // In our case, we are monitoring one wallet and the address is `accountAddress`.

      let transactions

      try {
        transactions = await this.tonweb.provider.getTransactions(
          this.accountAddress,
          COUNT,
          offsetTransactionLT,
          offsetTransactionHash,
          undefined,
          true,
        )
      } catch (error) {
        logger.error(error)
        // if an API error occurs, try again
        retryCount += 1
        if (retryCount < 10) {
          await sleep(retryCount * 1000)
          return getTransactions(
            time,
            offsetTransactionLT,
            offsetTransactionHash,
            retryCount,
          )
        }
        return 0
      }

      logger.debug(`Got ${transactions.length} transactions`)

      if (transactions.length === 0) {
        // If you use your own API instance make sure the code contains this fix https://github.com/toncenter/ton-http-api/commit/a40a31c62388f122b7b7f3da7c5a6f706f3d2405
        // If you use public toncenter.com then everything is OK.
        return time
      }

      if (!time) time = transactions[0].utime

      for (const tx of transactions) {
        if (tx.utime < this.startTime) {
          return time
        }

        await this.onTransaction(tx)
      }

      if (transactions.length === 1) {
        return time
      }

      const lastTx = transactions.at(-1)
      return getTransactions(
        time,
        lastTx.transaction_id.lt,
        lastTx.transaction_id.hash,
        0,
      )
    }

    let isProcessing = false

    const tick = async () => {
      if (isProcessing) return
      isProcessing = true

      try {
        const result = await getTransactions(undefined, undefined, undefined, 0)
        if ((result ?? 0) > 0) {
          this.startTime = result // store in your database
        }
      } catch (error) {
        logger.error(error)
      }

      isProcessing = false
    }

    setInterval(tick, 30 * 1000) // poll every 30 seconds
    await tick()
  }
}
