import type { DocumentType } from '@typegoose/typegoose'
import type { EquipmentRarity } from '#root/common/helpers/equipment'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { EQUIPMENT_RARITIES } from '#root/common/helpers/equipment'

// One reward per (week, user) — the settlement idempotency boundary. A re-run of
// the settlement worker collides on E11000 and grants nothing twice.
@index({ weekId: 1, userId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class BossReward extends TimeStamps {
  @prop({ type: Number, required: true })
  weekId!: number

  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true, enum: EQUIPMENT_RARITIES })
  rarity!: EquipmentRarity

  @prop({ type: String })
  equipmentId?: string
}

const BossRewardModel = getModelForClass(BossReward)

BossRewardModel.collection.createIndex({ weekId: 1, userId: 1 }, { unique: true }).catch(() => {})

export { BossRewardModel }

// Claims the (week, user) reward slot. Returns the doc, or null if already
// rewarded (E11000) — the caller then skips minting the drop.
export async function claimBossReward(weekId: number, userId: number, rarity: EquipmentRarity): Promise<DocumentType<BossReward> | null> {
  try {
    return await BossRewardModel.create({ weekId, userId, rarity }) as unknown as DocumentType<BossReward>
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000) return null
    throw err
  }
}

export async function linkRewardEquipment(rewardId: unknown, equipmentId: string): Promise<void> {
  await BossRewardModel.updateOne({ _id: rewardId }, { $set: { equipmentId } })
}
