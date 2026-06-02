import type { DocumentType } from '@typegoose/typegoose'
import type { WalletEntryType } from '#root/common/helpers/wallet';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { WALLET_CURRENCY } from '#root/common/helpers/wallet'

export enum WalletEntryStatus {
  Created = 'created',
  Completed = 'completed',
  Failed = 'failed',
}

@modelOptions({ schemaOptions: { timestamps: true } })
export class WalletLedger extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true })
  type!: WalletEntryType

  // Signed micro-USDT: positive credits the user, negative debits.
  @prop({ type: BigInt, required: true })
  amount!: bigint

  @prop({ type: String, required: true, default: WALLET_CURRENCY })
  currency!: string

  // Idempotency key: xRocket payment id (deposit), or our generated
  // withdrawalId/transferId (debit). Unique — a replay collides on E11000.
  @prop({ type: String, required: true, unique: true, index: true })
  externalId!: string

  @prop({ type: String, required: true, default: WalletEntryStatus.Created })
  status!: WalletEntryStatus

  @prop({ type: Object, required: false })
  meta?: Record<string, unknown>
}

const WalletLedgerModel = getModelForClass(WalletLedger)

WalletLedgerModel.collection.createIndex({ externalId: 1 }, { unique: true }).catch(() => {})

export { WalletLedgerModel }

// Insert a ledger row. Throws `{ code: 11000 }` if `externalId` already exists —
// callers translate that into "already processed" (idempotent replay).
export async function insertLedgerEntry(entry: {
  userId: number
  type: WalletEntryType
  amount: bigint
  externalId: string
  status?: WalletEntryStatus
  meta?: Record<string, unknown>
}): Promise<DocumentType<WalletLedger>> {
  return WalletLedgerModel.create({
    currency: WALLET_CURRENCY,
    status: WalletEntryStatus.Created,
    ...entry,
  }) as unknown as Promise<DocumentType<WalletLedger>>
}

export async function setLedgerStatus(
  externalId: string,
  status: WalletEntryStatus,
  meta?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (meta) update.meta = meta
  await WalletLedgerModel.updateOne({ externalId }, { $set: update })
}

// Sum of all completed ledger amounts for a currency — the reconciliation total.
export async function sumLedger(currency: string = WALLET_CURRENCY): Promise<bigint> {
  const rows = await WalletLedgerModel.find({ currency, status: WalletEntryStatus.Completed })
  return rows.reduce((total, row) => total + row.amount, 0n)
}
