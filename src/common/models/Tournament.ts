import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { TOURNAMENT_ENTRY_CUBE } from '#root/common/helpers/tournament'

// One document per tournament week, keyed on weekId (Monday-aligned, derived
// from the clock by tournament.ts). Mirrors World.ts's lifecycle helpers.
@index({ weekId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Tournament extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  weekId!: number

  @prop({ type: Number, required: true, default: TOURNAMENT_ENTRY_CUBE })
  entryFeeCube!: number

  @prop({ type: Number, required: true, default: 0 })
  entrantCount!: number

  // Prize pool snapshot taken once at settlement, in micro-USDT.
  @prop({ type: BigInt, required: true, default: 0n })
  prizePoolMicro!: bigint

  @prop({ type: Boolean, required: true, default: false, index: true })
  settled!: boolean
}

const TournamentModel = getModelForClass(Tournament)

export { TournamentModel }

// Idempotent: safe to call every interval / at boot. Creates the week's doc if
// missing, otherwise a no-op.
export async function findOrCreateTournament(weekId: number): Promise<void> {
  await TournamentModel.updateOne(
    { weekId },
    { $setOnInsert: { weekId, entryFeeCube: TOURNAMENT_ENTRY_CUBE, entrantCount: 0, prizePoolMicro: 0n, settled: false } },
    { upsert: true },
  )
}

export async function incrementEntrants(weekId: number): Promise<void> {
  await TournamentModel.updateOne({ weekId }, { $inc: { entrantCount: 1 } })
}

export function findTournament(weekId: number) {
  return TournamentModel.findOne({ weekId })
}

// Unsettled tournaments for fully-closed weeks (weekId < currentWeekId), oldest
// first.
export function findUnsettledTournaments(currentWeekId: number) {
  return TournamentModel.find({ settled: false, weekId: { $lt: currentWeekId } }).sort({ weekId: 1 })
}

// Single-shot CAS: flip settled false->true and snapshot the pool. Returns true
// only for the caller that won the flip, so the pool figure is frozen once.
export async function markTournamentSettled(
  weekId: number,
  prizePoolMicro: bigint,
): Promise<boolean> {
  const result = await TournamentModel.findOneAndUpdate(
    { weekId, settled: false },
    { $set: { settled: true, prizePoolMicro } },
    { new: false },
  )
  return result !== null
}
