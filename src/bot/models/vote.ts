import { modelOptions, prop, getModelForClass } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";

@modelOptions({
  schemaOptions: { timestamps: true },
})
export class Vote extends TimeStamps {
  @prop({ type: Number, required: true })
  giver!: number;

  @prop({ type: Number, required: true })
  receiver!: number;

  @prop({ type: Number, required: true })
  quantity!: number;
}

export const VoteModel = getModelForClass(Vote);

export async function isUserAlreadyVoted(giver: number) {
  const user = await VoteModel.findOne({ giver });
  return !!user;
}
