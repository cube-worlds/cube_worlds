import type { DocumentType } from '@typegoose/typegoose'
import type { HeroClass } from '#root/common/helpers/hero'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { HERO_CLASSES } from '#root/common/helpers/hero'

@index({ userId: 1 })
@index({ nftMinted: 1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Hero extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true, enum: HERO_CLASSES })
  heroClass!: HeroClass

  @prop({ type: Number, required: true, default: 1 })
  level!: number

  @prop({ type: Number, required: true, default: 0 })
  xp!: number

  // The user's first hero is soulbound (non-transferable) — anti-Sybil.
  @prop({ type: Boolean, required: true, default: false })
  soulbound!: boolean

  // Exclusive Founder variant if recruited by an existing CNFT holder.
  @prop({ type: Boolean, required: true, default: false })
  founderVariant!: boolean

  // Deploy-gated NFT mint state (mirrors Castle).
  @prop({ type: Boolean, required: true, default: false, index: true })
  nftMinted!: boolean

  @prop({ type: String })
  nftAddress?: string
}

const HeroModel = getModelForClass(Hero)

export { HeroModel }

export function isFirstHero(existingCount: number): boolean {
  return existingCount === 0
}

export function countHeroesByUser(userId: number): Promise<number> {
  return HeroModel.countDocuments({ userId })
}

export function findHeroesByUser(userId: number) {
  return HeroModel.find({ userId }).sort({ createdAt: 1 })
}

// Ownership-scoped lookup: only returns the hero if it belongs to userId.
export function findHeroForUser(userId: number, heroId: string) {
  return HeroModel.findOne({ _id: heroId, userId })
}

export interface CreateHeroInput {
  userId: number
  heroClass: HeroClass
  soulbound: boolean
  founderVariant: boolean
}

export async function createHero(input: CreateHeroInput): Promise<DocumentType<Hero>> {
  return HeroModel.create({ ...input, level: 1, xp: 0, nftMinted: false }) as unknown as Promise<DocumentType<Hero>>
}

// Set absolute xp/level (computed by the pure applyXp). Idempotency for the
// daily grant is provided by the DungeonRun credited flip, so a plain set is safe.
export async function grantHeroXp(heroId: string, xp: number, level: number): Promise<void> {
  await HeroModel.updateOne({ _id: heroId }, { $set: { xp, level } })
}

export function findUnmintedHeroes(limit = 10) {
  return HeroModel.find({ nftMinted: false }).limit(limit)
}

export async function markHeroMinted(heroId: unknown, address: string): Promise<void> {
  await HeroModel.updateOne({ _id: heroId }, { $set: { nftMinted: true, nftAddress: address } })
}
