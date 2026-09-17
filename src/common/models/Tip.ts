import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'

// One row per holder tip. The compound unique index makes a re-added reaction
// or a repeated /tip on the same message a no-op (E11000 ⇒ not credited).
@modelOptions({
  schemaOptions: { timestamps: { createdAt: true, updatedAt: false } },
})
@index({ chatId: 1, messageId: 1, tipperId: 1 }, { unique: true })
@index({ tipperId: 1, createdAt: 1 })
class Tip {
  @prop({ type: Number, required: true })
  tipperId!: number

  @prop({ type: Number, required: true })
  recipientId!: number

  @prop({ type: Number, required: true })
  chatId!: number

  @prop({ type: Number, required: true })
  messageId!: number

  @prop({ type: BigInt, required: true })
  votes!: bigint

  @prop({ type: Date })
  createdAt?: Date
}

const TipModel = getModelForClass(Tip)

export interface TipInput {
  tipperId: number
  recipientId: number
  chatId: number
  messageId: number
  votes: bigint
}

// True if this call inserted the row; false if the same tipper already tipped
// this message (duplicate update — do not credit).
export async function recordTip(tip: TipInput): Promise<boolean> {
  try {
    await TipModel.create(tip)
    return true
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false
    throw error
  }
}

export async function countTipsSince(tipperId: number, since: Date): Promise<number> {
  return TipModel.countDocuments({ tipperId, createdAt: { $gte: since } })
}
