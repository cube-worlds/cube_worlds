import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { getEnumKeyByValue } from '#root/common/helpers/enum'

export type BalanceChangeKeys = keyof typeof BalanceChangeType

export enum BalanceChangeType {
  Unknown = -1,
  Initial = 0,
  Deposit = 1, // $CUBE jettons
  Withdraw = 2,
  Dice = 3,
  Referral = 4,
  Donation = 5, // TON
  Task = 6,
  Claim = 7,
  Trade = 8, // for $SATOSHI
  Expedition = 9, // CUBE faucet: expedition payout
  Spend = 10, // CUBE sink: energy refill / weight-boost
  CastleUpgrade = 11, // CUBE sink: castle upgrade track (100% burn)
  Recruit = 12, // CUBE sink: Tavern hero recruitment
}

export function getBalanceChangeTypeName(
  type: BalanceChangeType,
): BalanceChangeKeys {
  return getEnumKeyByValue(BalanceChangeType, type) ?? 'Unknown'
}

@modelOptions({
  schemaOptions: { timestamps: { createdAt: true, updatedAt: false } },
  options: {},
})
class Balance {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: BigInt, required: true })
  amount!: bigint

  @prop({ type: Number, required: true, index: true })
  type!: BalanceChangeType

  @prop({ type: Date, required: false })
  createdAt?: Date
}

const BalanceModel = getModelForClass(Balance)

export async function countAllBalanceRecords(): Promise<number> {
  return BalanceModel.countDocuments()
}

export async function countUserBalanceRecords(userId: number): Promise<number> {
  return BalanceModel.countDocuments({ userId })
}

export async function addChangeBalanceRecord(
  userId: number,
  amount: bigint,
  type: BalanceChangeType,
) {
  const balance = new BalanceModel({
    userId,
    amount,
    type,
  })
  return balance.save()
}

export async function getAggregatedBalance(userId: number): Promise<bigint> {
  const balance = await BalanceModel.aggregate([
    {
      $match: {
        userId,
      },
    },
    {
      $group: {
        _id: undefined,
        amount: { $sum: '$amount' },
      },
    },
  ])
  return balance[0].amount
}

export async function getUserBalanceRecords(
  userId: number,
  count: number = 20,
): Promise<Balance[]> {
  return BalanceModel.find({ userId }).sort({ createdAt: -1 }).limit(count)
}

// Tournament scoring: sum of CUBE earned from expeditions in [since, until) per
// user, restricted to the given user set. Returns a Map keyed by userId. Used by
// both the live tournament leaderboard and the weekly settlement worker.
export async function sumExpeditionCubeByUser(
  since: Date,
  until: Date,
  userIds: number[],
): Promise<Map<number, bigint>> {
  if (userIds.length === 0)
    return new Map()
  const rows = await BalanceModel.aggregate<{ _id: number, amount: bigint }>([
    {
      $match: {
        type: BalanceChangeType.Expedition,
        userId: { $in: userIds },
        createdAt: { $gte: since, $lt: until },
      },
    },
    { $group: { _id: '$userId', amount: { $sum: '$amount' } } },
  ])
  return new Map(rows.map(r => [r._id, BigInt(r.amount ?? 0)]))
}
