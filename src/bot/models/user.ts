import {
  getModelForClass,
  modelOptions,
  prop,
  DocumentType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses.js";
import { Address } from "@ton/core";

export enum UserState {
  WaitNothing = "WaitNothing",
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

  @prop({ type: String, required: false, default: UserState.WaitNothing })
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
  avatar?: string;

  @prop({ type: String })
  wallet?: string;

  @prop({ type: Boolean, required: true, default: false })
  minted!: boolean;

  // for admin

  @prop({ type: Number })
  selectedUser?: number;

  @prop({ type: String })
  nftDescription?: string;

  @prop({ type: String })
  nftImage?: string;

  @prop({ type: String })
  nftJson?: string;

  @prop({ type: String })
  nftUrl?: string;
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

export async function findUserByAddress(
  address: Address,
): Promise<DocumentType<User> | null> {
  const wallet = address.toString();
  return UserModel.findOne({ wallet });
}

export async function findUserById(
  id: number,
): Promise<DocumentType<User> | null> {
  return UserModel.findOne({ id });
}

export function findQueue() {
  return UserModel.find({ minted: false, state: UserState.Submited })
    .sort({ votes: -1 })
    .limit(10);
}

export async function placeInLine(votes: number): Promise<number> {
  const count = await UserModel.countDocuments({
    minted: false,
    state: UserState.Submited,
    votes: { $gte: votes },
  });
  if (count === 0) {
    return 1;
  }
  return count;
}
