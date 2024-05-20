import {
  getModelForClass,
  modelOptions,
  prop,
  DocumentType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses.js";
import { Address } from "@ton/core";
import { logger } from "#root/logger";
import { ClipGuidancePreset, SDSampler } from "../helpers/generation";

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

  @prop({ type: Number })
  referalId?: number;

  @prop({ type: Date, required: true, default: new Date(+0) })
  dicedAt!: Date;

  @prop({ type: Number, min: 1, max: 6 })
  diceSeriesNumber?: number;

  // how many times recurred
  @prop({ type: Number })
  diceSeries?: number;

  // for captcha purposes
  @prop({ type: Number })
  suspicionDices?: number;

  // for dice callback query
  @prop({ type: String })
  diceKey?: string;

  @prop({ type: String })
  name?: string;

  // user provided description
  @prop({ type: String })
  description?: string;

  // result that will be in NFT
  @prop({ type: String })
  nftDescription?: string;

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

  @prop({ type: Date })
  mintedAt?: Date;

  @prop({ type: Boolean })
  diceWinner?: boolean;

  // for admin

  @prop({ type: Number })
  selectedUser?: number;

  @prop({ type: Number })
  avatarNumber?: number;

  @prop({ type: String })
  nftImage?: string;

  @prop({ type: String })
  nftJson?: string;

  @prop({ type: String })
  nftUrl?: string;

  // to spoof user provided description
  @prop({ type: String })
  customDescription?: string;

  @prop({ type: String })
  positivePrompt?: string;

  @prop({ type: String })
  negativePrompt?: string;

  @prop({ type: Number })
  strength?: number;

  @prop({ type: Number })
  scale?: number;

  @prop({ type: Number })
  steps?: number;

  @prop({ type: String })
  preset?: ClipGuidancePreset;

  @prop({ type: String })
  sampler?: SDSampler;
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

export async function findUserByName(
  name: string,
): Promise<DocumentType<User> | null> {
  return UserModel.findOne({ name });
}

export function findQueue() {
  return UserModel.find({ minted: false, state: UserState.Submited })
    .sort({ diceWinner: -1, votes: -1 })
    .limit(10);
}

export function findMintedWithDate() {
  return UserModel.find({ minted: true, mintedAt: { $exists: true } }).sort({
    mintedAt: -1,
  });
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

export function countAllLine(): Promise<number> {
  return UserModel.countDocuments({
    state: UserState.Submited,
    minted: false,
  });
}

export function findAllByCreated() {
  return UserModel.find({ wallet: { $exists: true } }).sort({ createdAt: 1 });
}

export function findWhales(limit: number) {
  return UserModel.find({ wallet: { $exists: true } })
    .select({ _id: 0, wallet: 1, votes: 1, minted: 1 })
    .limit(limit)
    .sort({ votes: -1 });
}

export function findLine(limit: number) {
  return UserModel.find({
    state: UserState.Submited,
    minted: false,
  })
    .select({ _id: 0, name: 1, votes: 1, minted: 1, diceWinner: 1 })
    .limit(limit)
    .sort({ diceWinner: -1, votes: -1 });
}

export function countUsers(minted: boolean) {
  return UserModel.countDocuments({ minted, state: UserState.Submited });
}

export async function placeInLine(votes: bigint): Promise<number | undefined> {
  const count = await UserModel.countDocuments({
    minted: false,
    state: UserState.Submited,
    votes: { $gte: votes },
  });
  if (count === 0) {
    return undefined;
  }
  return count;
}

export async function placeInWhales(
  votes: bigint,
): Promise<number | undefined> {
  const count = await UserModel.countDocuments({
    votes: { $gte: votes },
  });
  if (count === 0) {
    return undefined;
  }
  return count;
}

export async function addPoints(userId: number, add: bigint) {
  try {
    const updatedUser = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { votes: add } },
      { new: true },
    );
    if (!updatedUser) {
      throw new Error("User for addPoints not found");
    }
    logger.info(`Add ${add} points to ${userId}. Now ${updatedUser.votes}`);
    // TODO: save log in db
    return updatedUser.votes;
  } catch (error) {
    logger.error(`!!! Can't add points ${add} to user ${userId}`);
    throw error;
  }
}
