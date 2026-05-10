import type { Transaction } from '@ton/core'
import { sleep } from '#root/common/helpers/time'
import { tonClient } from '#root/common/helpers/ton'
import { logger } from '#root/logger'
import { Address } from '@ton/core'

const COUNT = 10
const POLL_INTERVAL_MS = 30 * 1000

export class AccountSubscription {
  accountAddress: Address

  startTime: number

  onTransaction: (tx: Transaction) => Promise<void>

  constructor(
    accountAddress: string,
    startTime: number,
    onTransaction: (tx: Transaction) => Promise<void>,
  ) {
    this.accountAddress = Address.parse(accountAddress)
    // start unixtime (stored in your database), transactions made earlier will be discarded.
    this.startTime = startTime
    this.onTransaction = onTransaction
  }

  async start() {
    const fetchOnce = async (
      time: number | undefined,
      offsetLt: string | undefined,
      offsetHash: string | undefined,
      retryCount: number,
    ): Promise<number | undefined> => {
      if (offsetLt) {
        logger.debug(
          `Get ${COUNT} transactions before transaction ${offsetLt}:${offsetHash}`,
        )
      }

      let transactions: Transaction[]

      try {
        transactions = await tonClient.getTransactions(this.accountAddress, {
          limit: COUNT,
          lt: offsetLt,
          hash: offsetHash,
          archival: true,
        })
      } catch (error) {
        logger.error(error)
        const nextRetry = retryCount + 1
        if (nextRetry < 10) {
          await sleep(nextRetry * 1000)
          return fetchOnce(time, offsetLt, offsetHash, nextRetry)
        }
        return 0
      }

      logger.debug(`Got ${transactions.length} transactions`)

      if (transactions.length === 0) {
        return time
      }

      let cursorTime = time
      if (cursorTime === undefined) cursorTime = transactions[0].now

      for (const tx of transactions) {
        if (tx.now < this.startTime) {
          return cursorTime
        }
        await this.onTransaction(tx)
      }

      if (transactions.length === 1) {
        return cursorTime
      }

      const lastTx = transactions[transactions.length - 1]
      if (!lastTx) {
        return cursorTime
      }
      return fetchOnce(
        cursorTime,
        lastTx.lt.toString(),
        lastTx.hash().toString('base64'),
        0,
      )
    }

    let isProcessing = false

    const tick = async () => {
      if (isProcessing) return
      isProcessing = true

      try {
        const result = await fetchOnce(undefined, undefined, undefined, 0)
        if ((result ?? 0) > 0) {
          this.startTime = result as number
        }
      } catch (error) {
        logger.error(error)
      }

      isProcessing = false
    }

    setInterval(tick, POLL_INTERVAL_MS)
    await tick()
  }
}
