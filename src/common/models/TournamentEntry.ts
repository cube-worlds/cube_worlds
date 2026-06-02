import type { DocumentType } from '@typegoose/typegoose'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

// One entry per user per week — unique compound index, declared at schema level
// so Mongoose surfaces the duplicate-entry collision (E11000) through the normal
// flow. Mirrors Expedition.ts (entry + claim CAS).
@index({ userId: 1, weekId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class TournamentEntry extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: Number, required: true, index: true })
  weekId!: number

  // True when the entry was waived by an active Season Pass (free), false when
  // the user paid the CUBE entry fee.
  @prop({ type: Boolean, required: true, default: false })
  bonus!: boolean

  // Computed at settlement: CUBE earned from expeditions during the week.
  @prop({ type: BigInt, required: true, default: 0n })
  scoreCube!: bigint

  @prop({ type: Number, required: true, default: 0 })
  rank!: number

  @prop({ type: BigInt, required: true, default: 0n })
  payoutMicro!: bigint

  @prop({ type: Boolean, required: true, default: false, index: true })
  paid!: boolean
}

const TournamentEntryModel = getModelForClass(TournamentEntry)

export { TournamentEntryModel }

// Throws E11000 if the user already entered this week — callers translate that
// into a ClientError.
export async function enterTournament(
  userId: number,
  weekId: number,
  bonus: boolean,
): Promise<DocumentType<TournamentEntry>> {
  return TournamentEntryModel.create({ userId, weekId, bonus }) as unknown as Promise<DocumentType<TournamentEntry>>
}

export function findEntry(userId: number, weekId: number) {
  return TournamentEntryModel.findOne({ userId, weekId })
}

export function findEntries(weekId: number) {
  return TournamentEntryModel.find({ weekId })
}

export async function setEntryResult(
  entryId: unknown,
  result: { scoreCube: bigint, rank: number, payoutMicro: bigint },
): Promise<void> {
  await TournamentEntryModel.updateOne({ _id: entryId }, { $set: result })
}

// CAS: flip paid false->true. The winner is the one runner that should pay this
// entry's prize, so payouts can't double-run.
export async function claimPayout(entryId: unknown): Promise<boolean> {
  const result = await TournamentEntryModel.findOneAndUpdate(
    { _id: entryId, paid: false },
    { $set: { paid: true } },
    { new: false },
  )
  return result !== null
}
