import type { Transaction } from '@ton/core'
import { Address } from '@ton/core'
import { logger } from '#root/logger'

const COUNT = 10
const POLL_INTERVAL_MS = 30 * 1000

export interface AccountSubscriptionDependencies {
  getTransactions: (
    address: Address,
    options: {
      limit: number
      lt: string | undefined
      hash: string | undefined
      archival: boolean
    },
  ) => Promise<Transaction[]>
  sleep: (ms: number) => Promise<void>
  setInterval: (handler: () => void, ms: number) => unknown
}

async function createDefaultDependencies(): Promise<AccountSubscriptionDependencies> {
  const { tonClient } = await import('#root/common/helpers/ton')
  const { sleep } = await import('#root/common/helpers/time')
  return {
    getTransactions: (address, options) =>
      tonClient.getTransactions(address, options),
    sleep,
    setInterval: (handler, ms) => setInterval(handler, ms),
  }
}

export class AccountSubscription {
  accountAddress: Address

  startTime: number

  onTransaction: (tx: Transaction) => Promise<void>

  deps: AccountSubscriptionDependencies | null

  constructor(
    accountAddress: string,
    startTime: number,
    onTransaction: (tx: Transaction) => Promise<void>,
    deps?: AccountSubscriptionDependencies,
  ) {
    this.accountAddress = Address.parse(accountAddress)
    // start unixtime (stored in your database), transactions made earlier will be discarded.
    this.startTime = startTime
    this.onTransaction = onTransaction
    this.deps = deps ?? null
  }

  async start() {
    if (!this.deps) {
      this.deps = await createDefaultDependencies()
    }
    const deps = this.deps
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
        transactions = await deps.getTransactions(this.accountAddress, {
          limit: COUNT,
          lt: offsetLt,
          hash: offsetHash,
          archival: true,
        })
      } catch (error) {
        logger.error(error)
        const nextRetry = retryCount + 1
        if (nextRetry < 10) {
          await deps.sleep(nextRetry * 1000)
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

    deps.setInterval(tick, POLL_INTERVAL_MS)
    await tick()
  }
}
