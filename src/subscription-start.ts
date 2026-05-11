import type { AccountSubscription } from '#root/common/helpers/account-subscription'
import type { Transaction } from '@ton/core'
import { AccountSubscription as DefaultAccountSubscription } from '#root/common/helpers/account-subscription'
import { getLastestTransaction } from '#root/common/models/Transaction'
import { config } from '#root/config'

export interface StartProcessTransactionsDependencies {
  getCollectionOwner: () => string
  getLastestTransaction: () => Promise<{ utime?: number } | null>
  createSubscription: (
    address: string,
    startTime: number,
    onTransaction: (tx: Transaction) => Promise<void>,
  ) => Pick<AccountSubscription, 'start'>
}

function createDefaultDependencies(): StartProcessTransactionsDependencies {
  return {
    getCollectionOwner: () => config.COLLECTION_OWNER,
    getLastestTransaction,
    createSubscription: (address, startTime, onTransaction) =>
      new DefaultAccountSubscription(address, startTime, onTransaction),
  }
}

export function buildStartProcessTransactions(
  deps: StartProcessTransactionsDependencies = createDefaultDependencies(),
) {
  return async function startProcessTransactions(
    onTransaction: (tx: Transaction) => Promise<void>,
  ) {
    const latestTrx = await deps.getLastestTransaction()
    const startTime = latestTrx?.utime ?? 0
    const subscription = deps.createSubscription(
      deps.getCollectionOwner(),
      startTime,
      onTransaction,
    )
    await subscription.start()
  }
}
