import { Address } from "@ton/core"
import { DocumentType, getModelForClass, modelOptions, prop } from "@typegoose/typegoose"

export enum CNFTImageType {
  Dice = "Dice",
  Whale = "Whale",
  Diamond = "Diamond",
  Coin = "Coin",
  Knight = "Knight",
  Common = "Common",
}

const colors = [
  "#000000",
  "#000099",
  "#00FF33",
  "#FF00FF",
  "#FF0099",
  "#FF6600",
  "#99FF00",
  "#FF3300",
  "#9933FF",
  "#3300FF",
  "#00CCFF",
]

export function cnftHexColor(colorNumber: number): string {
  return colors[colorNumber % colors.length]
}

@modelOptions({ schemaOptions: { timestamps: false } })
export class CNFT {
  @prop({ type: Number, required: true, index: true, unique: true })
  index!: number

  @prop({ type: Number, required: true, index: true, unique: true })
  userId!: number

  @prop({ type: String, required: true })
  wallet!: string // in non-bounceble format (UQ)

  @prop({ type: BigInt, required: true })
  votes!: bigint

  @prop({ type: Number, required: true })
  referrals!: number

  @prop({ type: Boolean, required: true })
  minted!: boolean

  @prop({ type: Boolean, required: true })
  diceWinner!: boolean

  // image specific

  @prop({ type: String, required: true })
  type!: CNFTImageType

  @prop({ type: Number, required: true })
  color!: number
}

const CNFTModel = getModelForClass(CNFT)

export async function getCNFTByWallet(address: string) {
  const wallet = Address.parse(address)
  return CNFTModel.findOne({ wallet: wallet.toString({ bounceable: false }) })
}

export async function getCNFTByIndex(index: number) {
  return CNFTModel.findOne({ index })
}

export async function getLastestCNFT() {
  return CNFTModel.findOne().sort({ index: -1 })
}

export async function getLastestCNFTWithType(type: CNFTImageType) {
  return CNFTModel.findOne({ type }).sort({ index: -1 })
}

export async function addCNFT(
  userId: number,
  address: Address,
  votes: bigint,
  referrals: number,
  minted: boolean,
  diceWinner: boolean,
): Promise<DocumentType<CNFT>> {
  const existsUserCNFT = await CNFTModel.findOne({ userId })
  if (existsUserCNFT) {
    throw new Error(`(${existsUserCNFT.index}) User ${userId} already exists`)
  }
  const wallet = address.toString({ bounceable: false })
  const existsCNFT = await CNFTModel.findOne({ wallet })
  if (existsCNFT) {
    throw new Error(`(${existsCNFT.index}) Wallet ${wallet} already exists`)
  }
  const latestCNFT = await getLastestCNFT()
  const latestIndex = latestCNFT?.index ?? -1
  const index = latestIndex + 1

  let type: CNFTImageType = CNFTImageType.Common
  if (diceWinner) {
    type = CNFTImageType.Dice
  } else if (votes > BigInt(1_000_000)) {
    type = CNFTImageType.Whale
  } else if (votes > BigInt(500_000)) {
    type = CNFTImageType.Diamond
  } else if (votes > BigInt(100_000)) {
    type = CNFTImageType.Coin
  } else if (referrals > 0) {
    type = CNFTImageType.Knight
  }

  const cnftWithType = await getLastestCNFTWithType(type)
  const latestColor = cnftWithType?.color ?? -1
  const currentColor = latestColor + 1
  const color = currentColor % colors.length
  return CNFTModel.create({
    index,
    userId,
    wallet,
    votes,
    referrals,
    minted,
    diceWinner,
    type,
    color,
  })
}

export function getAllCNFTs() {
  return CNFTModel.find()
}
