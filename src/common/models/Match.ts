import type { ResourceBag } from '#root/common/helpers/production'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

export const MATCH_MODES = ['arena', 'raid'] as const
export type MatchMode = (typeof MATCH_MODES)[number]

// Immutable side snapshot, taken at insert. Stats are FINAL (post-equipment,
// post-walls for a raid defender) and rating is the at-insert ladder value, so
// a crash-retry resolves the identical fight with the identical ELO delta —
// later gear/level/rating changes never alter a recorded match.
export class MatchSide {
  @prop({ type: Number, required: true })
  userId!: number

  @prop({ type: String, required: true })
  name!: string

  @prop({ type: String, required: true })
  heroId!: string

  @prop({ type: String, required: true })
  heroClass!: string

  @prop({ type: Number, required: true })
  level!: number

  @prop({ type: Number, required: true })
  rating!: number

  @prop({ type: Number, required: true })
  hp!: number

  @prop({ type: Number, required: true })
  atk!: number

  @prop({ type: Number, required: true })
  def!: number
}

@index({ attackerId: 1, status: 1 })
@index({ attackerId: 1, createdAt: -1 })
@index({ defenderId: 1, createdAt: -1 })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Match extends TimeStamps {
  @prop({ type: String, required: true, enum: MATCH_MODES })
  mode!: MatchMode

  @prop({ type: Number, required: true, index: true })
  attackerId!: number

  @prop({ type: Number, required: true, index: true })
  defenderId!: number

  @prop({ _id: false, type: MatchSide, required: true })
  attacker!: MatchSide

  @prop({ _id: false, type: MatchSide, required: true })
  defender!: MatchSide

  // Raid CUBE stake (plain Number — always small; converted to bigint at refund).
  @prop({ type: Number, required: true, default: 0 })
  stake!: number

  // The pending→resolved CAS is the exactly-once credit boundary.
  @prop({ type: String, required: true, enum: ['pending', 'resolved'], default: 'pending', index: true })
  status!: 'pending' | 'resolved'

  @prop({ type: Number })
  seed?: number

  @prop({ type: Boolean })
  attackerWon?: boolean

  // Attacker's delta; the defender applied its negation.
  @prop({ type: Number })
  ratingDelta?: number

  @prop({ type: Number, required: true, default: 0 })
  xpGained!: number

  // Informational copy of the plundered loot for history display — the
  // ResourceLedger rows are canonical. Written after the credit lands.
  @prop({ type: Number, required: true, default: 0 })
  lootGold!: number

  @prop({ type: Number, required: true, default: 0 })
  lootIron!: number

  @prop({ type: Number, required: true, default: 0 })
  lootMana!: number

  @prop({ type: Number, required: true, default: 0 })
  lootFood!: number
}

const MatchModel = getModelForClass(Match)

export { MatchModel }

export interface CreateMatchInput {
  mode: MatchMode
  attackerId: number
  defenderId: number
  stake: number
  attacker: MatchSide
  defender: MatchSide
}

export async function createPendingMatch(input: CreateMatchInput) {
  return MatchModel.create({ ...input, status: 'pending' })
}

// A user has at most one crash-stranded pending match at a time in practice
// (matches resolve inside the same request) — sweep oldest-first regardless.
export function findPendingMatchByAttacker(attackerId: number) {
  return MatchModel.findOne({ attackerId, status: 'pending' }).sort({ createdAt: 1 })
}

export interface MatchResolution {
  seed: number
  attackerWon: boolean
  ratingDelta: number
  xpGained: number
}

// CAS: flip pending→resolved. Only the winner applies side effects.
export async function resolveMatchCas(matchId: unknown, result: MatchResolution): Promise<boolean> {
  const res = await MatchModel.updateOne(
    { _id: matchId, status: 'pending' },
    { $set: { status: 'resolved', ...result } },
  )
  return res.modifiedCount === 1
}

// Informational history write — after the ledger rows landed (canonical).
export async function recordMatchLoot(matchId: unknown, loot: ResourceBag): Promise<void> {
  await MatchModel.updateOne(
    { _id: matchId },
    { $set: { lootGold: loot.gold, lootIron: loot.iron, lootMana: loot.mana, lootFood: loot.food } },
  )
}

export function findRecentMatches(userId: number, limit = 20) {
  const capped = Math.min(50, Math.max(1, limit))
  return MatchModel.find({ $or: [{ attackerId: userId }, { defenderId: userId }] })
    .sort({ createdAt: -1 })
    .limit(capped)
}
