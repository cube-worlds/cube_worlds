import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

export enum UserState {
  WaitImage = "WaitImage",
  WaitName = "WaitName",
  WaitDescription = "WaitDescription",
  WaitWallet = "WaitWallet",
  Submited = "Submited",
}

@modelOptions({ schemaOptions: { timestamps: true } })
export class User {
  @prop({ type: Number, required: true, index: true, unique: true })
  id!: number;

  @prop({ type: String, required: true, default: "en" })
  language!: string;

  @prop({ type: String, required: false, default: UserState.WaitImage })
  state!: UserState;

  @prop({ type: Number, required: false, default: 0 })
  votes!: number;
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
