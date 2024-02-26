import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses.js";

export enum UserState {
  WaitDescription = "WaitDescription",
  WaitWallet = "WaitWallet",
  Submited = "Submited",
}

@modelOptions({ schemaOptions: { timestamps: true } })
export class User extends TimeStamps {
  @prop({ type: Number, required: true, index: true, unique: true })
  id!: number;

  @prop({ type: String, required: true, default: "en" })
  language!: string;

  @prop({ type: String, required: false, default: UserState.WaitDescription })
  state!: UserState;

  @prop({ type: Number, required: false, default: 0 })
  votes!: number;

  @prop({ type: Date, required: true, default: new Date(+0) })
  dicedAt!: Date;

  @prop({ type: String })
  name?: string;

  @prop({ type: String })
  description?: string;

  @prop({ type: String })
  image?: string;

  @prop({ type: String })
  wallet?: string;

  @prop({ type: Boolean, required: true, default: false })
  minted!: boolean;
}

const UserModel = getModelForClass(User);

export function findOrCreateUser(id: number) {
  return UserModel.findOneAndUpdate(
    { id },
    {},
    {
      upsert: true,
      new: true,
    },
  );
}

export function findQueue() {
  return UserModel.find({ minted: false, state: UserState.Submited })
    .sort({ votes: -1 })
    .limit(10);
}
