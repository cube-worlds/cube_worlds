import type { DocumentType } from '@typegoose/typegoose'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

export type QuestStatus = 'active' | 'claimed'

// One ACTIVE quest per hero: a unique PARTIAL index over only the active rows.
// Claimed quests are exempt, so a hero can quest again once it has been claimed.
@index({ heroId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } })
@index({ userId: 1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class HeroQuest extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true })
  heroId!: string

  @prop({ type: Date, required: true })
  startedAt!: Date

  @prop({ type: Date, required: true })
  endsAt!: Date

  @prop({ type: Number, required: true })
  seed!: number

  @prop({ type: Number, required: true })
  heroLevelAtStart!: number

  @prop({ type: String, required: true, enum: ['active', 'claimed'], default: 'active' })
  status!: QuestStatus
}

const HeroQuestModel = getModelForClass(HeroQuest)

HeroQuestModel.collection
  .createIndex({ heroId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } })
  .catch(() => {})

export { HeroQuestModel }

export interface StartQuestInput {
  userId: number
  heroId: string
  startedAt: Date
  endsAt: Date
  seed: number
  heroLevelAtStart: number
}

// Starts a quest. Returns the doc, or null if the hero already has an active
// quest (E11000 on the partial-unique index).
export async function startQuest(input: StartQuestInput): Promise<DocumentType<HeroQuest> | null> {
  try {
    return await HeroQuestModel.create({ ...input, status: 'active' }) as unknown as DocumentType<HeroQuest>
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000) return null
    throw err
  }
}

export function findActiveQuestForHero(heroId: string) {
  return HeroQuestModel.findOne({ heroId, status: 'active' })
}

export function findActiveQuestsForUser(userId: number) {
  return HeroQuestModel.find({ userId, status: 'active' }).sort({ endsAt: 1 })
}

// Ownership-scoped; null on a bad id (no cast throw).
export function findQuestById(userId: number, questId: string) {
  return HeroQuestModel.findOne({ _id: questId, userId })
}

// CAS: flip active→claimed. Only the winner credits loot/XP/drop (exactly-once).
export async function claimQuest(questId: unknown): Promise<boolean> {
  const result = await HeroQuestModel.updateOne(
    { _id: questId, status: 'active' },
    { $set: { status: 'claimed' } },
  )
  return result.modifiedCount === 1
}
