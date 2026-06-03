import type { ResourceBag } from '#root/common/helpers/production'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

@index({ userId: 1, day: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class DungeonRun extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: Number, required: true })
  day!: number

  @prop({ type: String, required: true })
  heroId!: string

  @prop({ type: Number, required: true })
  seed!: number

  @prop({ type: Boolean, required: true })
  win!: boolean

  @prop({ type: Number, required: true, default: 0 })
  lootGold!: number

  @prop({ type: Number, required: true, default: 0 })
  lootIron!: number

  @prop({ type: Number, required: true, default: 0 })
  lootMana!: number

  @prop({ type: Number, required: true, default: 0 })
  lootFood!: number

  @prop({ type: Number, required: true, default: 0 })
  xpGained!: number

  // Exactly-once credit flag — flipped by a CAS so loot/XP credit only once.
  @prop({ type: Boolean, required: true, default: false, index: true })
  credited!: boolean
}

const DungeonRunModel = getModelForClass(DungeonRun)

DungeonRunModel.collection.createIndex({ userId: 1, day: 1 }, { unique: true }).catch(() => {})

export { DungeonRunModel }

export interface ClaimDungeonInput {
  userId: number
  day: number
  heroId: string
  seed: number
  win: boolean
  loot: ResourceBag
  xpGained: number
}

// Claims the day for this user. Returns the run doc on success, or null if the
// day is already claimed (E11000) — the caller then loads the existing run and
// does NOT re-credit.
export async function claimDungeonRun(input: ClaimDungeonInput) {
  try {
    return await DungeonRunModel.create({
      userId: input.userId,
      day: input.day,
      heroId: input.heroId,
      seed: input.seed,
      win: input.win,
      lootGold: input.loot.gold,
      lootIron: input.loot.iron,
      lootMana: input.loot.mana,
      lootFood: input.loot.food,
      xpGained: input.xpGained,
      credited: false,
    })
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000) return null
    throw err
  }
}

export function findDungeonRun(userId: number, day: number) {
  return DungeonRunModel.findOne({ userId, day })
}

// CAS: flip credited false→true. Only the winner credits loot/XP.
export async function claimDungeonCredit(runId: unknown): Promise<boolean> {
  const result = await DungeonRunModel.updateOne(
    { _id: runId, credited: false },
    { $set: { credited: true } },
  )
  return result.modifiedCount === 1
}
