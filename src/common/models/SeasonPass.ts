import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { ENERGY_MAX, SEASON_PASS_ENERGY_CAP } from '#root/common/helpers/energy'

export const SEASON_PASS_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

// Per-user subscription state. `activeUntil` is the expiry; a new charge extends
// it by one period from the later of now / current expiry (so an early renewal
// stacks rather than truncates).
@modelOptions({ schemaOptions: { timestamps: true } })
export class SeasonPass extends TimeStamps {
  @prop({ type: Number, required: true, unique: true, index: true })
  userId!: number

  @prop({ type: Date, required: true })
  activeUntil!: Date

  @prop({ type: String, required: true, default: 'season' })
  tier!: string

  @prop({ type: Date, required: false })
  lastChargeAt?: Date
}

const SeasonPassModel = getModelForClass(SeasonPass)

export { SeasonPassModel }

// Separate charge record, unique on the Telegram charge id, so a replayed
// `successful_payment` update is a no-op (the insert collides on E11000 and we
// skip extending the pass).
@modelOptions({ schemaOptions: { timestamps: true } })
export class SeasonPassCharge extends TimeStamps {
  @prop({ type: String, required: true, unique: true, index: true })
  telegramPaymentChargeId!: string

  @prop({ type: Number, required: true, index: true })
  userId!: number
}

const SeasonPassChargeModel = getModelForClass(SeasonPassCharge)

SeasonPassChargeModel.collection.createIndex({ telegramPaymentChargeId: 1 }, { unique: true }).catch(() => {})

export { SeasonPassChargeModel }

// Pure: the new expiry after applying one period, stacking on any unexpired
// remainder. Unit-tested without a DB.
export function extendActiveUntil(
  now: Date,
  currentActiveUntil: Date | undefined,
  periodMs: number = SEASON_PASS_PERIOD_MS,
): Date {
  const base = currentActiveUntil && currentActiveUntil.getTime() > now.getTime()
    ? currentActiveUntil.getTime()
    : now.getTime()
  return new Date(base + periodMs)
}

// Idempotent on the charge id: records the charge first; if it already exists,
// returns without re-granting. Otherwise extends (or creates) the pass.
export async function grantSeasonPass(input: {
  userId: number
  telegramPaymentChargeId: string
  // Telegram's authoritative subscription expiry, when present. If omitted, the
  // expiry is computed by extending one period from the later of now / current.
  activeUntil?: Date
  now?: Date
}): Promise<void> {
  const now = input.now ?? new Date()
  try {
    await SeasonPassChargeModel.create({
      telegramPaymentChargeId: input.telegramPaymentChargeId,
      userId: input.userId,
    })
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000)
      return // already processed this charge
    throw err
  }
  const existing = await SeasonPassModel.findOne({ userId: input.userId })
  const activeUntil = input.activeUntil ?? extendActiveUntil(now, existing?.activeUntil)
  await SeasonPassModel.updateOne(
    { userId: input.userId },
    { $set: { activeUntil, lastChargeAt: now, tier: 'season' } },
    { upsert: true },
  )
}

export async function isSeasonPassActive(
  userId: number,
  now: Date = new Date(),
): Promise<boolean> {
  const doc = await SeasonPassModel.findOne({ userId })
  return !!doc && doc.activeUntil.getTime() > now.getTime()
}

// The effective energy cap for a user: elevated while the pass is active.
export async function energyCapFor(
  userId: number,
  now: Date = new Date(),
): Promise<number> {
  return (await isSeasonPassActive(userId, now)) ? SEASON_PASS_ENERGY_CAP : ENERGY_MAX
}
