import type { DocumentType } from '@typegoose/typegoose'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

// One attack per user per UTC day per week — rate-limits the shared damage board
// (mirrors the daily-dungeon unique claim).
@index({ userId: 1, weekId: 1, day: 1 }, { unique: true })
@index({ weekId: 1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class BossAttack extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: Number, required: true })
  weekId!: number

  @prop({ type: Number, required: true })
  day!: number

  @prop({ type: String, required: true })
  heroId!: string

  @prop({ type: Number, required: true })
  seed!: number

  @prop({ type: Number, required: true, default: 0 })
  damage!: number
}

const BossAttackModel = getModelForClass(BossAttack)

BossAttackModel.collection.createIndex({ userId: 1, weekId: 1, day: 1 }, { unique: true }).catch(() => {})

export { BossAttackModel }

export interface RecordBossAttackInput {
  userId: number
  weekId: number
  day: number
  heroId: string
  seed: number
  damage: number
}

// Records the day's attack. Returns the doc, or null if the user already attacked
// today this week (E11000) — the deterministic seed means the result is fixed anyway.
export async function recordBossAttack(input: RecordBossAttackInput): Promise<DocumentType<BossAttack> | null> {
  try {
    return await BossAttackModel.create(input) as unknown as DocumentType<BossAttack>
  }
  catch (err) {
    if ((err as { code?: number }).code === 11000) return null
    throw err
  }
}

export function hasAttackedToday(userId: number, weekId: number, day: number) {
  return BossAttackModel.findOne({ userId, weekId, day })
}

export async function findUserBossDamage(userId: number, weekId: number): Promise<number> {
  const rows = await BossAttackModel.aggregate<{ total: number }>([
    { $match: { userId, weekId } },
    { $group: { _id: null, total: { $sum: '$damage' } } },
  ])
  return rows[0]?.total ?? 0
}

// Ranked contributor board for a week: [{ userId, total }] descending.
export async function aggregateDamageByUser(weekId: number): Promise<Array<{ userId: number, total: number }>> {
  const rows = await BossAttackModel.aggregate<{ _id: number, total: number }>([
    { $match: { weekId } },
    { $group: { _id: '$userId', total: { $sum: '$damage' } } },
    { $sort: { total: -1, _id: 1 } },
  ])
  return rows.map(r => ({ userId: r._id, total: r.total }))
}

export async function distinctAttackWeeks(): Promise<number[]> {
  const weeks = await BossAttackModel.distinct('weekId')
  return (weeks as number[]).sort((a, b) => a - b)
}
