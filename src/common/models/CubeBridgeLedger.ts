import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { getEnumKeyByValue } from '#root/common/helpers/enum'

export enum CubeBridgeEntryType {
  Unknown = -1,
  Deposit = 0, // on-chain $CUBE -> DB votes
  Withdraw = 1, // DB votes -> on-chain $CUBE
}

export enum CubeBridgeStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

export type CubeBridgeKeys = keyof typeof CubeBridgeEntryType

export function getCubeBridgeTypeName(type: CubeBridgeEntryType): CubeBridgeKeys {
  return getEnumKeyByValue(CubeBridgeEntryType, type) ?? 'Unknown'
}

// Unique externalId makes replays a no-op (E11000), exactly like WalletLedger.
@modelOptions({ schemaOptions: { timestamps: true } })
export class CubeBridgeLedger extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: Number, required: true })
  type!: CubeBridgeEntryType

  // micro-CUBE units, gross (pre-fee). Stored as String to preserve bigint.
  @prop({ type: String, required: true })
  amount!: string

  @prop({ type: String, required: true })
  fee!: string

  // Idempotency key: on-chain tx hash (deposit) or our generated withdrawalId.
  // Unique — a replay collides on E11000, signalling "already processed".
  @prop({ type: String, required: true, unique: true, index: true })
  externalId!: string

  @prop({ type: String, required: true, enum: CubeBridgeStatus, default: CubeBridgeStatus.Pending })
  status!: CubeBridgeStatus
}

const CubeBridgeLedgerModel = getModelForClass(CubeBridgeLedger)

CubeBridgeLedgerModel.collection.createIndex({ externalId: 1 }, { unique: true }).catch(() => {})

export { CubeBridgeLedgerModel }

// Idempotent insert: a duplicate externalId collides on E11000 and returns
// false, signalling the caller this is a replay (mirrors WalletLedger).
export async function insertBridgeRow(row: {
  userId: number
  type: CubeBridgeEntryType
  amount: bigint
  fee: bigint
  externalId: string
  status?: CubeBridgeStatus
}): Promise<boolean> {
  try {
    await CubeBridgeLedgerModel.create({
      userId: row.userId,
      type: row.type,
      amount: row.amount.toString(),
      fee: row.fee.toString(),
      externalId: row.externalId,
      status: row.status ?? CubeBridgeStatus.Pending,
    })
    return true
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false
    throw err
  }
}

export async function markBridgeStatus(
  externalId: string,
  status: CubeBridgeStatus,
): Promise<void> {
  await CubeBridgeLedgerModel.updateOne({ externalId }, { $set: { status } })
}

// Most recent completed withdraw, for the cooldown check.
export async function lastWithdrawAt(userId: number): Promise<Date | null> {
  const row = await CubeBridgeLedgerModel.findOne({
    userId,
    type: CubeBridgeEntryType.Withdraw,
    status: CubeBridgeStatus.Completed,
  }).sort({ createdAt: -1 })
  return row?.createdAt ?? null
}
