import { getEnumKeyByValue } from '#root/common/helpers/enum'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

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
}

export function getBalanceChangeTypeName(type: BalanceChangeType): BalanceChangeKeys {
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
