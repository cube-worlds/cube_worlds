import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

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

export interface VoteHelperDependencies {
  findGiver: (giver: number) => Promise<unknown | null>
  countByReceiver: (receiver: number) => Promise<number>
}

function createDefaultDependencies(): VoteHelperDependencies {
  return {
    findGiver: (giver) => VoteModel.findOne({ giver }),
    countByReceiver: (receiver) => VoteModel.countDocuments({ receiver }),
  }
}

export function buildVoteHelpers(
  dependencies: VoteHelperDependencies = createDefaultDependencies(),
) {
  return {
    isUserAlreadyVoted: async (giver: number): Promise<boolean> => {
      const vote = await dependencies.findGiver(giver)
      return !!vote
    },
    referralsCount: (receiver: number): Promise<number> => {
      return dependencies.countByReceiver(receiver)
    },
  }
}

const defaultHelpers = buildVoteHelpers()

export const isUserAlreadyVoted = defaultHelpers.isUserAlreadyVoted
export const referralsCount = defaultHelpers.referralsCount
