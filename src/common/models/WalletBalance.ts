import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { ClientError } from '#root/common/errors'
import { WALLET_CURRENCY } from '#root/common/helpers/wallet'

@modelOptions({ schemaOptions: { timestamps: true } })
export class WalletBalance extends TimeStamps {
  @prop({ type: Number, required: true, unique: true })
  userId!: number

  @prop({ type: String, required: true, default: WALLET_CURRENCY })
  currency!: string

  // micro-USDT (1 USDT = 1_000_000)
  @prop({ type: BigInt, required: true, default: 0n })
  balance!: bigint
}

const WalletBalanceModel = getModelForClass(WalletBalance)

export { WalletBalanceModel }

// Credit (or create) a user's balance by `amount` micro-USDT; returns the new
// balance. Upsert so a first-ever deposit creates the row.
export async function creditBalance(userId: number, amount: bigint): Promise<bigint> {
  const doc = await WalletBalanceModel.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount }, $setOnInsert: { currency: WALLET_CURRENCY } },
    { upsert: true, new: true },
  )
  return doc!.balance
}

// The atomic decrement seam, injected in tests. Returns the remaining balance,
// or null if the conditional update matched nothing (insufficient funds).
export type DecrementOp = (userId: number, amount: bigint) => Promise<bigint | null>

const decrementAtomic: DecrementOp = async (userId, amount) => {
  const doc = await WalletBalanceModel.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  )
  return doc ? doc.balance : null
}

// Atomically debit `amount` micro-USDT, throwing ClientError if the balance is
// insufficient. The `{ balance: $gte amount }` filter makes overdraft impossible
// even under concurrent debits.
export async function applyDebit(
  userId: number,
  amount: bigint,
  decrement: DecrementOp = decrementAtomic,
): Promise<bigint> {
  const remaining = await decrement(userId, amount)
  if (remaining === null) {
    throw new ClientError('Insufficient balance')
  }
  return remaining
}

export async function getBalance(userId: number): Promise<bigint> {
  const doc = await WalletBalanceModel.findOne({ userId })
  return doc?.balance ?? 0n
}
