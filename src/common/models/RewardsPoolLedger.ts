import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { WALLET_CURRENCY } from '#root/common/helpers/wallet'

// The append-only treasury ledger for the 20%-of-revenue rewards pool. Accruals
// are positive micro-USDT, tournament payouts are negative. The pool balance is
// the sum of all rows. Modeled on WalletLedger: a unique `externalId` makes
// every write idempotent — a replayed accrual or payout collides on E11000.
export enum RewardsEntryType {
  AccrualBuyEnergy = 'accrual_buy_energy',
  AccrualAd = 'accrual_ad',
  AccrualSeasonPass = 'accrual_season_pass',
  Payout = 'payout',
}

// allowMixed: `meta` is a deliberately schemaless bag (accrual/payout
// context) — Mixed is intended, not an accident.
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class RewardsPoolLedger extends TimeStamps {
  @prop({ type: String, required: true })
  type!: RewardsEntryType

  // Signed micro-USDT: positive accrues to the pool, negative pays out.
  @prop({ type: BigInt, required: true })
  amount!: bigint

  @prop({ type: String, required: true, default: WALLET_CURRENCY })
  currency!: string

  // Idempotency key (e.g. `accrual:buyenergy:<ledgerId>` or
  // `payout:<weekId>:<userId>`). Unique — a replay collides on E11000.
  @prop({ type: String, required: true, unique: true, index: true })
  externalId!: string

  @prop({ type: Object, required: false })
  meta?: Record<string, unknown>
}

const RewardsPoolLedgerModel = getModelForClass(RewardsPoolLedger)

RewardsPoolLedgerModel.collection.createIndex({ externalId: 1 }, { unique: true }).catch(() => {})

export { RewardsPoolLedgerModel }

interface RewardsEntry {
  type: RewardsEntryType
  amount: bigint
  externalId: string
  meta?: Record<string, unknown>
}

// Insert an accrual row. A duplicate `externalId` (already accrued) is swallowed
// so a retried revenue event is a no-op rather than an error.
export async function accrueRewards(entry: RewardsEntry): Promise<void> {
  try {
    await RewardsPoolLedgerModel.create({ currency: WALLET_CURRENCY, ...entry })
  }
  catch (err) {
    if ((err as { code?: number }).code !== 11000)
      throw err
  }
}

// Insert a payout row (negative amount). Idempotent on `externalId` —
// `payout:<weekId>:<userId>` is paid at most once.
export async function recordPayout(entry: {
  weekId: number
  userId: number
  amount: bigint
}): Promise<void> {
  await accrueRewards({
    type: RewardsEntryType.Payout,
    amount: -entry.amount,
    externalId: `payout:${entry.weekId}:${entry.userId}`,
    meta: { weekId: entry.weekId, userId: entry.userId },
  })
}

// Current pool balance = sum of every ledger row's signed amount.
export async function poolBalance(): Promise<bigint> {
  const rows = await RewardsPoolLedgerModel.find({ currency: WALLET_CURRENCY })
  return rows.reduce((total, row) => total + row.amount, 0n)
}
