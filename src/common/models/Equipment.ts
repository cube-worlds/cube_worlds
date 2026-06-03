import type { DocumentType } from '@typegoose/typegoose'
import type { EquipmentRarity, EquipmentSlot } from '#root/common/helpers/equipment'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { EQUIPMENT_RARITIES, EQUIPMENT_SLOTS } from '#root/common/helpers/equipment'

export type EquipmentSource = 'quest' | 'boss'

// One item per (hero, slot): a unique PARTIAL index over only the equipped rows
// (equippedHeroId is a string). Unequipped items (null) are exempt, so a player
// can hold many spare weapons in inventory but wear only one.
@index(
  { equippedHeroId: 1, slot: 1 },
  { unique: true, partialFilterExpression: { equippedHeroId: { $type: 'string' } } },
)
@index({ userId: 1 })
@index({ nftMinted: 1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Equipment extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true, enum: EQUIPMENT_SLOTS })
  slot!: EquipmentSlot

  @prop({ type: String, required: true, enum: EQUIPMENT_RARITIES })
  rarity!: EquipmentRarity

  // Snapshot of the stat bonus at creation (table rebalances never restat owned gear).
  @prop({ type: Number, required: true, default: 0 })
  bonusHp!: number

  @prop({ type: Number, required: true, default: 0 })
  bonusAtk!: number

  @prop({ type: Number, required: true, default: 0 })
  bonusDef!: number

  // null/absent = in inventory; a string heroId = worn by that hero.
  @prop({ type: String, default: null })
  equippedHeroId?: string | null

  @prop({ type: String, required: true, enum: ['quest', 'boss'] })
  source!: EquipmentSource

  // Deploy-gated NFT mint state (mirrors Hero/Castle).
  @prop({ type: Boolean, required: true, default: false, index: true })
  nftMinted!: boolean

  @prop({ type: String })
  nftAddress?: string
}

const EquipmentModel = getModelForClass(Equipment)

EquipmentModel.collection
  .createIndex({ equippedHeroId: 1, slot: 1 }, { unique: true, partialFilterExpression: { equippedHeroId: { $type: 'string' } } })
  .catch(() => {})

export { EquipmentModel }

export interface CreateEquipmentInput {
  userId: number
  slot: EquipmentSlot
  rarity: EquipmentRarity
  bonus: { hp: number, atk: number, def: number }
  source: EquipmentSource
}

export async function createEquipment(input: CreateEquipmentInput): Promise<DocumentType<Equipment>> {
  return EquipmentModel.create({
    userId: input.userId,
    slot: input.slot,
    rarity: input.rarity,
    bonusHp: input.bonus.hp,
    bonusAtk: input.bonus.atk,
    bonusDef: input.bonus.def,
    source: input.source,
    equippedHeroId: null,
    nftMinted: false,
  }) as unknown as Promise<DocumentType<Equipment>>
}

export function findEquipmentByUser(userId: number) {
  return EquipmentModel.find({ userId }).sort({ createdAt: 1 })
}

export function findEquippedForHero(heroId: string) {
  return EquipmentModel.find({ equippedHeroId: heroId })
}

// Ownership-scoped lookup; null on a bad id (no cast throw → no 500).
export function findEquipmentForUser(userId: number, equipmentId: string) {
  return EquipmentModel.findOne({ _id: equipmentId, userId })
}

export type EquipResult = 'ok' | 'slot-occupied' | 'not-available'

// Atomic equip: flip an unequipped, owned item onto the hero. The slot-exclusivity
// is enforced by the unique partial index — a second item for the same (hero, slot)
// trips E11000 → 'slot-occupied'. A CAS that matches nothing (already equipped /
// not owned) → 'not-available'.
export async function equipItem(userId: number, equipmentId: string, heroId: string): Promise<EquipResult> {
  try {
    const updated = await EquipmentModel.findOneAndUpdate(
      { _id: equipmentId, userId, equippedHeroId: null },
      { $set: { equippedHeroId: heroId } },
      { new: true },
    )
    return updated ? 'ok' : 'not-available'
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000) return 'slot-occupied'
    throw err
  }
}

export async function unequipItem(userId: number, equipmentId: string): Promise<boolean> {
  const result = await EquipmentModel.updateOne(
    { _id: equipmentId, userId, equippedHeroId: { $ne: null } },
    { $set: { equippedHeroId: null } },
  )
  return result.modifiedCount === 1
}

export function findUnmintedEquipment(limit = 10) {
  return EquipmentModel.find({ nftMinted: false }).limit(limit)
}

export async function markEquipmentMinted(equipmentId: unknown, address: string): Promise<void> {
  await EquipmentModel.updateOne({ _id: equipmentId }, { $set: { nftMinted: true, nftAddress: address } })
}
