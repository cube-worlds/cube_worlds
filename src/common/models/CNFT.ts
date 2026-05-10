import type { DocumentType } from '@typegoose/typegoose'
import { Address } from '@ton/core'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

export enum CNFTImageType {
  Dice = 'Dice',
  Whale = 'Whale',
  Diamond = 'Diamond',
  Coin = 'Coin',
  Knight = 'Knight',
  Common = 'Common',
}

const colors = [
  '#000000',
  '#000099',
  '#00FF33',
  '#FF00FF',
  '#FF0099',
  '#FF6600',
  '#99FF00',
  '#FF3300',
  '#9933FF',
  '#3300FF',
  '#00CCFF',
]

export function cnftHexColor(colorNumber: number): string {
  return colors[colorNumber % colors.length]
}

export function pickCNFTType(
  votes: bigint,
  referrals: number,
  diceWinner: boolean,
): CNFTImageType {
  if (diceWinner) return CNFTImageType.Dice
  if (votes > 1_000_000n) return CNFTImageType.Whale
  if (votes > 500_000n) return CNFTImageType.Diamond
  if (votes > 100_000n) return CNFTImageType.Coin
  if (referrals > 0) return CNFTImageType.Knight
  return CNFTImageType.Common
}

export function pickNextColor(latestColorForType: number | undefined): number {
  return ((latestColorForType ?? -1) + 1) % colors.length
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

export interface ExistingCNFTRef {
  index: number
}

export interface CNFTCreateInput {
  index: number
  userId: number
  wallet: string
  votes: bigint
  referrals: number
  minted: boolean
  diceWinner: boolean
  type: CNFTImageType
  color: number
}

export interface CNFTHelperDependencies {
  findByUserId: (userId: number) => Promise<ExistingCNFTRef | null>
  findByWallet: (wallet: string) => Promise<ExistingCNFTRef | null>
  findLatest: () => Promise<{ index: number } | null>
  findLatestByType: (type: CNFTImageType) => Promise<{ color: number } | null>
  createCNFT: (input: CNFTCreateInput) => Promise<DocumentType<CNFT>>
}

function createDefaultCNFTDependencies(): CNFTHelperDependencies {
  return {
    findByUserId: (userId) => CNFTModel.findOne({ userId }),
    findByWallet: (wallet) => CNFTModel.findOne({ wallet }),
    findLatest: getLastestCNFT,
    findLatestByType: getLastestCNFTWithType,
    createCNFT: (input) => CNFTModel.create(input),
  }
}

export function buildCNFTHelpers(
  dependencies: CNFTHelperDependencies = createDefaultCNFTDependencies(),
) {
  return {
    addCNFT: async (
      userId: number,
      address: Address,
      votes: bigint,
      referrals: number,
      minted: boolean,
      diceWinner: boolean,
    ): Promise<DocumentType<CNFT>> => {
      const existsUserCNFT = await dependencies.findByUserId(userId)
      if (existsUserCNFT) {
        throw new Error(`(${existsUserCNFT.index}) User ${userId} already exists`)
      }
      const wallet = address.toString({ bounceable: false })
      const existsCNFT = await dependencies.findByWallet(wallet)
      if (existsCNFT) {
        throw new Error(`(${existsCNFT.index}) Wallet ${wallet} already exists`)
      }
      const latestCNFT = await dependencies.findLatest()
      const latestIndex = latestCNFT?.index ?? -1
      const index = latestIndex + 1

      const type = pickCNFTType(votes, referrals, diceWinner)
      const cnftWithType = await dependencies.findLatestByType(type)
      const color = pickNextColor(cnftWithType?.color)
      return dependencies.createCNFT({
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
    },
  }
}

const defaultCNFTHelpers = buildCNFTHelpers()

export const addCNFT = defaultCNFTHelpers.addCNFT

export function getAllCNFTs() {
  return CNFTModel.find()
}
