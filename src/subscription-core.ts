import type { Address, Transaction } from '@ton/core'
import { fromNano } from '@ton/core'
import { tonToPoints } from '#root/common/helpers/points'
import { parseInternalInMessage } from '#root/common/helpers/transaction-parsing'
import { BalanceChangeType } from '#root/common/models/Balance'

export interface SubscriptionUser {
  id: number
  votes: bigint
  language: string
  name?: string
  minted?: boolean
}

export interface SavedTransaction {
  markRejected: () => Promise<void>
}

export interface TransactionRecord {
  utime: number
  lt: number
  address: string
  coins: number
  ton: number
  hash: string
  accepted: boolean
}

export interface SubscriptionDependencies {
  findExistingTransaction: (lt: number, hash: string) => Promise<unknown | null>
  saveTransaction: (record: TransactionRecord) => Promise<SavedTransaction>
  findUserByAddress: (address: Address) => Promise<SubscriptionUser | null>
  addPoints: (
    userId: number,
    delta: bigint,
    type: BalanceChangeType,
  ) => Promise<bigint>
  sendMessage: (userId: number, text: string) => Promise<void>
  sendMessageToAdmins: (text: string) => Promise<void>
  translateDonation: (language: string, ton: number) => string
  info: (message: string) => void
  error: (message: string) => void
  debug: (message: string) => void
}

export async function processTransaction(
  tx: Transaction,
  deps: SubscriptionDependencies,
): Promise<void> {
  // It is important to check that Toncoins did not bounce back in case of an error
  if (tx.outMessagesCount > 0) return
  const parsed = parseInternalInMessage(tx)
  if (!parsed) return

  const { source: senderAddress, value, text: message } = parsed
  const lt = Number(tx.lt)
  const hash = tx.hash().toString('base64')
  const utime = tx.now

  const existing = await deps.findExistingTransaction(lt, hash)
  if (existing) {
    deps.debug(`Exists ${fromNano(value)} TON from ${senderAddress}`)
    return
  }

  const ton = Number(fromNano(value))

  const saved = await deps.saveTransaction({
    utime,
    lt,
    address: senderAddress.toString(),
    coins: Number(value),
    ton,
    hash,
    accepted: true,
  })
  deps.info(
    `Receive ${fromNano(value)} TON from ${senderAddress.toString()}"`,
  )

  const points = tonToPoints(ton)

  const user = await deps.findUserByAddress(senderAddress)
  if (!user) {
    await saved.markRejected()
    const notFoundMessage = `❗️ USER NOT FOUND FOR: ${ton} TON from ${senderAddress.toString({ bounceable: false })}`
    if (points > 1) {
      await deps.sendMessageToAdmins(notFoundMessage)
    }
    deps.error(notFoundMessage)
    return
  }

  await deps.addPoints(user.id, points, BalanceChangeType.Donation)

  await deps.sendMessage(user.id, deps.translateDonation(user.language, ton))

  await deps.sendMessageToAdmins(
    `🚀 RECEIVED ${ton} TON FROM @${user.name}${message ? ` with message "${message}"` : ''}. Minted: ${user.minted ? '✅' : '❌'}`,
  )
}
