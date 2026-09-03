import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'

// One row per successful Telegram Stars top-up. `chargeId` is Telegram's
// telegram_payment_charge_id — the unique index makes the credit idempotent:
// a replayed successful_payment update collides on E11000 and is a no-op.
@modelOptions({
  schemaOptions: { timestamps: { createdAt: true, updatedAt: false } },
})
@index({ userId: 1 })
class StarsPurchase {
  @prop({ type: String, required: true, unique: true })
  chargeId!: string

  @prop({ type: Number, required: true })
  userId!: number

  @prop({ type: Number, required: true })
  stars!: number

  @prop({ type: BigInt, required: true })
  votes!: bigint

  @prop({ type: Date })
  createdAt?: Date
}

const StarsPurchaseModel = getModelForClass(StarsPurchase)

// Records the purchase. Returns true if this call inserted the row, false if
// the chargeId was already recorded (duplicate webhook/update — do not credit).
export async function recordStarsPurchase(
  chargeId: string,
  userId: number,
  stars: number,
  votes: bigint,
): Promise<boolean> {
  try {
    await StarsPurchaseModel.create({ chargeId, userId, stars, votes })
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 11000) return false
    throw error
  }
}
