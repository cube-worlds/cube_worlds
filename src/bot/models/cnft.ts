import { Address } from "@ton/core";
import {
  DocumentType,
  getModelForClass,
  modelOptions,
  prop,
} from "@typegoose/typegoose";

export enum CNFTImageType {
  Whale = "whale",
  Dice = "dice",
  Common = "common",
}

export enum CNFTBackgroundColor {
  Black = 0,
  Red,
}

@modelOptions({ schemaOptions: { timestamps: false } })
export class CNFT {
  @prop({ type: Number, required: true, index: true, unique: true })
  index!: number;

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

  @prop({ type: Number, required: true })
  colorNumber!: CNFTBackgroundColor;
}

const CNFTModel = getModelForClass(CNFT);

export async function getLastestCNFT() {
  return CNFTModel.findOne().sort({ index: -1 });
}

export async function addCNFT(
  address: Address,
  votes: bigint,
  referrals: number,
  minted: boolean,
  diceWinner: boolean,
): Promise<DocumentType<CNFT>> {
  const rawWallet = address.toRawString();
  const existsCNFT = await CNFTModel.findOne({ wallet: rawWallet });
  if (existsCNFT) {
    throw new Error(`(${existsCNFT.index}) Wallet ${rawWallet} already exists`);
  }
  const latestCNFT = await getLastestCNFT();
  const latestIndex = latestCNFT?.index ?? -1;
  const currentIndex = latestIndex + 1;
  const image: CNFTImageType = CNFTImageType.Common; // TODO: calculations
  const colorNumber: CNFTBackgroundColor = CNFTBackgroundColor.Red; // TODO: calculations
  return CNFTModel.create({
    index: currentIndex,
    wallet: rawWallet,
    votes,
    referrals,
    minted,
    diceWinner,
    image,
    colorNumber,
  });
}

export function getAllCNFTs() {
  return CNFTModel.find();
}
