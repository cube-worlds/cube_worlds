import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

// Records one redeemed rewarded-ad grant. `nonceRand` is unique, enforcing
// single-use of an ad nonce; `day` (UTC YYYY-MM-DD) drives the per-user daily
// cap count.
@index({ userId: 1, day: 1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class AdGrant extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true, unique: true, index: true })
  nonceRand!: string

  @prop({ type: String, required: true })
  day!: string

  @prop({ type: Number, required: true })
  energy!: number
}

const AdGrantModel = getModelForClass(AdGrant)

AdGrantModel.collection.createIndex({ nonceRand: 1 }, { unique: true }).catch(() => {})

export { AdGrantModel }

// Pure: the UTC calendar day key for the daily cap.
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

// Throws E11000 if this nonce was already redeemed — the handler treats that as
// an idempotent replay (no second grant).
export async function recordAdGrant(input: {
  userId: number
  nonceRand: string
  day: string
  energy: number
}): Promise<void> {
  await AdGrantModel.create(input)
}

export async function countAdGrantsToday(userId: number, day: string): Promise<number> {
  return AdGrantModel.countDocuments({ userId, day })
}
