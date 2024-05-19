import { Address } from "@ton/core";
import {
  DocumentType,
  getModelForClass,
  modelOptions,
  prop,
} from "@typegoose/typegoose";

export enum CNFTImageType {
  Whale = "Whale",
  Dice = "Dice",
  Common = "Common",
}

export enum CNFTBackgroundColor {
  Black = "Black",
  Red = "Red",
}

@modelOptions({ schemaOptions: { timestamps: false } })
export class CNFT {
  @prop({ type: Number, required: true, index: true, unique: true })
  index!: number;

  @prop({ type: Number, required: true, index: true, unique: true })
  userId!: number;

  @prop({ type: String, required: true })
  wallet!: string; // in raw format

  @prop({ type: BigInt, required: true })
  votes!: bigint;

  @prop({ type: Number, required: true })
  referrals!: number;

  @prop({ type: Boolean, required: true })
  minted!: boolean;

  @prop({ type: Boolean, required: true })
  diceWinner!: boolean;

  // image specific

  @prop({ type: String, required: true })
  image!: CNFTImageType;

  @prop({ type: String, required: true })
  color!: CNFTBackgroundColor;
}

const CNFTModel = getModelForClass(CNFT);

export async function getCNFTByIndex(index: number) {
  return CNFTModel.findOne({ index });
}

export async function getLastestCNFT() {
  return CNFTModel.findOne().sort({ index: -1 });
}

export async function addCNFT(
  userId: number,
  address: Address,
  votes: bigint,
  referrals: number,
  minted: boolean,
  diceWinner: boolean,
): Promise<DocumentType<CNFT>> {
  const existsUserCNFT = await CNFTModel.findOne({ userId });
  if (existsUserCNFT) {
    throw new Error(`(${existsUserCNFT.index}) User ${userId} already exists`);
  }
  const wallet = address.toRawString();
  const existsCNFT = await CNFTModel.findOne({ wallet });
  if (existsCNFT) {
    throw new Error(`(${existsCNFT.index}) Wallet ${wallet} already exists`);
  }
  const latestCNFT = await getLastestCNFT();
  const latestIndex = latestCNFT?.index ?? -1;
  const index = latestIndex + 1;
  const image: CNFTImageType = CNFTImageType.Common; // TODO: calculations
  const color: CNFTBackgroundColor = CNFTBackgroundColor.Red; // TODO: calculations
  return CNFTModel.create({
    index,
    userId,
    wallet,
    votes,
    referrals,
    minted,
    diceWinner,
    image,
    color,
  });
}

export function getAllCNFTs() {
  return CNFTModel.find();
}
