import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses.js'

@modelOptions({
  schemaOptions: { timestamps: true },
})
export class Vote extends TimeStamps {
  @prop({ type: Number, required: true })
  giver!: number

  @prop({ type: Number, required: true })
  receiver!: number

  @prop({ type: Number, required: true })
  quantity!: number
}

export const VoteModel = getModelForClass(Vote)

export async function isUserAlreadyVoted(giver: number) {
  const user = await VoteModel.findOne({ giver })
  return !!user
}

export async function referralsCount(receiver: number) {
  const count = await VoteModel.countDocuments({ receiver })
  return count
}
