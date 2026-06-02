import type { DocumentType } from '@typegoose/typegoose'
import type { Risk } from '#root/common/helpers/congestion'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

// CUBE-boost sink conversion: this many CUBE buys one unit of world weight.
export const BOOST_CUBE_PER_WEIGHT = 100

// Effective weight a commitment carries into the congestion split.
export function commitmentWeight(energySpent: number, cubeBoost: number): number {
  return energySpent + Math.floor(Math.max(0, cubeBoost) / BOOST_CUBE_PER_WEIGHT)
}

// One expedition per user per tick — unique compound index, declared at schema
// level so Mongoose surfaces index errors through the normal boot flow.
@index({ userId: 1, tickId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Expedition extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: Number, required: true, index: true })
  tickId!: number

  @prop({ type: String, required: true })
  worldId!: string

  @prop({ type: Number, required: true })
  energySpent!: number

  @prop({ type: Number, required: true, default: 0 })
  cubeBoost!: number

  @prop({ type: Number, required: true })
  weight!: number

  @prop({ type: String, required: true })
  risk!: Risk

  @prop({ type: Boolean, required: true, default: false, index: true })
  settled!: boolean

  @prop({ type: Number, required: true, default: 0 })
  cubeAwarded!: number

  @prop({ type: Boolean, required: true, default: false, index: true })
  credited!: boolean
}

const ExpeditionModel = getModelForClass(Expedition)

export { ExpeditionModel }

export interface CreateExpeditionInput {
  userId: number
  tickId: number
  worldId: string
  energySpent: number
  cubeBoost: number
  weight: number
  risk: Risk
}

// Throws E11000 if the user already committed this tick — callers translate
// that into a ClientError.
export async function createExpedition(
  input: CreateExpeditionInput,
): Promise<DocumentType<Expedition>> {
  return ExpeditionModel.create({ ...input, settled: false, cubeAwarded: 0, credited: false }) as unknown as Promise<DocumentType<Expedition>>
}

export function findMyExpeditionForTick(userId: number, tickId: number) {
  return ExpeditionModel.findOne({ userId, tickId })
}

export function findUnsettledForWorld(tickId: number, worldId: string) {
  return ExpeditionModel.find({ tickId, worldId, settled: false })
}

// CAS: flip settled false->true and record the award in one update. Returns
// true only for the runner that won the flip, so settlement can't double-run.
export async function settleExpedition(
  expeditionId: unknown,
  award: number,
): Promise<boolean> {
  const result = await ExpeditionModel.findOneAndUpdate(
    { _id: expeditionId, settled: false },
    { $set: { settled: true, cubeAwarded: award } },
    { new: false },
  )
  return result !== null
}

// Settled-but-not-yet-credited rows, for crash-safe credit replay.
export function findSettledUncredited(limit = 500) {
  return ExpeditionModel.find({ settled: true, credited: false }).limit(limit)
}

// CAS: flip credited false->true. The winner is the one runner that should
// call addPoints for this expedition.
export async function claimCredit(expeditionId: unknown): Promise<boolean> {
  const result = await ExpeditionModel.findOneAndUpdate(
    { _id: expeditionId, credited: false },
    { $set: { credited: true } },
    { new: false },
  )
  return result !== null
}
