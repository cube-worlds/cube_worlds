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

  @prop({ type: Boolean })
  languageSelected?: boolean;

  @prop({ type: String, required: false, default: UserState.WaitNothing })
  state!: UserState;

  @prop({ type: BigInt, required: false, default: 0 })
  votes!: bigint;

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

  @prop({ type: Number })
  lastSendedPlace?: number; // for notification purposes

  @prop({ type: Boolean, required: true, default: false })
  minted!: boolean;

  // for admin

  @prop({ type: Number })
  selectedUser?: number;

  @prop({ type: Number })
  avatarNumber?: number;

  @prop({ type: String })
  nftDescription?: string;

  @prop({ type: String })
  nftImage?: string;

  @prop({ type: String })
  nftJson?: string;

  @prop({ type: String })
  nftUrl?: string;

  @prop({ type: String })
  positivePrompt?: string;

  @prop({ type: String })
  negativePrompt?: string;

  @prop({ type: Number })
  strength?: number;
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
  // EQ address
  const bounceableAddress = address.toString({ bounceable: true });
  // UQ address
  const nonBounceableAddress = address.toString({ bounceable: false });
  const user = await UserModel.findOne({
    wallet: bounceableAddress,
  });
  if (user) {
    return user;
  }
  return UserModel.findOne({ wallet: nonBounceableAddress });
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

export async function countAllBalances(): Promise<number> {
  const result = await UserModel.aggregate([
    { $group: { _id: undefined, sum: { $sum: "$votes" } } },
  ]);
  if (result.length === 0) {
    return 0;
  }
  return Number.parseFloat(result[0].sum);
}

export function countAllWallets(): Promise<number> {
  return UserModel.countDocuments({ wallet: { $exists: true } });
}

export function findTopWallets(limit: number) {
  return UserModel.find({ wallet: { $exists: true } })
    .select({ _id: 0, wallet: 1, votes: 1, minted: 1 })
    .limit(limit)
    .sort({ votes: -1 });
}

export function countUsers(minted: boolean) {
  return UserModel.countDocuments({ minted, state: UserState.Submited });
}

export async function placeInLine(votes: bigint): Promise<number> {
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
