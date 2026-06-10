import type { DocumentType } from '@typegoose/typegoose'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { RAIDS_PER_DAY, RATING_FLOOR, RATING_START } from '#root/common/helpers/pvp'

@modelOptions({ schemaOptions: { timestamps: true } })
export class PvpProfile extends TimeStamps {
  @prop({ type: Number, required: true, unique: true, index: true })
  userId!: number

  // Single ELO ladder — arena AND raids move it (one ladder, kept honest by
  // every mode that matches on it; see the spec's rating-tanking note).
  @prop({ type: Number, required: true, default: RATING_START, index: true })
  rating!: number

  @prop({ type: Number, required: true, default: 0 })
  wins!: number

  @prop({ type: Number, required: true, default: 0 })
  losses!: number

  // Set only when a raid against this user SUCCEEDS (they lost resources).
  @prop({ type: Date })
  shieldUntil?: Date

  // UTC day bucket of the last raid + count within it (lazy reset on day change).
  @prop({ type: Number, required: true, default: -1 })
  raidDay!: number

  @prop({ type: Number, required: true, default: 0 })
  raidsToday!: number
}

const PvpProfileModel = getModelForClass(PvpProfile)

PvpProfileModel.collection.createIndex({ userId: 1 }, { unique: true }).catch(() => {})

export { PvpProfileModel }

// Atomic upsert — same E11000-recovery shape as findOrCreateCastle.
export async function findOrCreatePvpProfile(userId: number): Promise<DocumentType<PvpProfile>> {
  try {
    const profile = await PvpProfileModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    if (profile) return profile as DocumentType<PvpProfile>
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err
  }
  const existing = await PvpProfileModel.findOne({ userId })
  if (!existing) throw new Error('PvpProfile disappeared after duplicate-key recovery')
  return existing as DocumentType<PvpProfile>
}

// Atomic floor-clamped rating move + W/L bump. PIPELINE update, never
// read-modify-write: a user can be the defender in two concurrent matches and
// a stale $set would lose one delta. Upserts so an unrated defender gets a
// profile on first contact ($ifNull fills the defaults pipeline updates skip).
export async function applyRatingDelta(userId: number, delta: number, won: boolean): Promise<void> {
  await PvpProfileModel.updateOne(
    { userId },
    [{
      $set: {
        userId: { $ifNull: ['$userId', userId] },
        rating: { $max: [RATING_FLOOR, { $add: [{ $ifNull: ['$rating', RATING_START] }, delta] }] },
        wins: { $add: [{ $ifNull: ['$wins', 0] }, won ? 1 : 0] },
        losses: { $add: [{ $ifNull: ['$losses', 0] }, won ? 0 : 1] },
        raidDay: { $ifNull: ['$raidDay', -1] },
        raidsToday: { $ifNull: ['$raidsToday', 0] },
      },
    }],
    { upsert: true },
  )
}

// CAS claim of one of today's raid slots. Matches only while under the cap (or
// on a fresh day), so two concurrent raids can't both take the 3rd slot.
// Caller must findOrCreatePvpProfile first (updateOne matches an existing row).
export async function claimRaidSlot(userId: number, day: number): Promise<boolean> {
  const result = await PvpProfileModel.updateOne(
    { userId, $or: [{ raidDay: { $ne: day } }, { raidsToday: { $lt: RAIDS_PER_DAY } }] },
    [{
      $set: {
        raidsToday: { $cond: [{ $eq: ['$raidDay', day] }, { $add: ['$raidsToday', 1] }, 1] },
        raidDay: day,
      },
    }],
  )
  return result.modifiedCount === 1
}

// Give the slot back on every refund path (no target / not enough CUBE / Food).
export async function releaseRaidSlot(userId: number, day: number): Promise<void> {
  await PvpProfileModel.updateOne(
    { userId, raidDay: day, raidsToday: { $gt: 0 } },
    { $inc: { raidsToday: -1 } },
  )
}

export async function setShield(userId: number, until: Date): Promise<void> {
  await PvpProfileModel.updateOne(
    { userId },
    { $set: { shieldUntil: until } },
    { upsert: true, setDefaultsOnInsert: true },
  )
}
