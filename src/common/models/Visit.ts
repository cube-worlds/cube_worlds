import type { Move } from '#root/game/places'
import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'

// One Bali visit per holder per 8h window. Stake is debited at creation
// (Balance ledger `Stake`), payout credited once at resolution (`Payout`).
@modelOptions({ schemaOptions: { timestamps: { createdAt: true, updatedAt: false } } })
@index({ userId: 1, windowId: 1 }, { unique: true })
@index({ windowId: 1, resolved: 1 })
@index({ windowId: 1, place: 1, inviteCode: 1 })
@index({ userId: 1, resolved: 1, windowId: -1 })
class Visit {
  @prop({ type: Number, required: true })
  userId!: number

  @prop({ type: Number, required: true })
  windowId!: number

  @prop({ type: String, required: true })
  place!: string

  @prop({ type: String })
  move?: Move

  @prop({ type: BigInt, required: true })
  stake!: bigint

  @prop({ type: String })
  inviteCode?: string

  @prop({ type: Number })
  partnerId?: number

  // Pass index of whoever the engine paired us with, set at resolution.
  @prop({ type: Number })
  partnerPass?: number

  @prop({ type: Boolean, required: true, default: false })
  resolved!: boolean

  @prop({ type: BigInt })
  payout?: bigint

  @prop({ type: String })
  outcome?: string

  @prop({ type: Date })
  createdAt?: Date
}

const VisitModel = getModelForClass(Visit)

export interface VisitRecord {
  id: string
  userId: number
  windowId: number
  place: string
  move: Move | null
  stake: bigint
  inviteCode?: string
  partnerId?: number
  partnerPass?: number
  resolved: boolean
  payout?: bigint
  outcome?: string
  createdAt?: Date
}

function toRecord(doc: Visit & { _id: unknown }): VisitRecord {
  return {
    id: String(doc._id),
    userId: doc.userId,
    windowId: doc.windowId,
    place: doc.place,
    move: doc.move ?? null,
    stake: BigInt(doc.stake),
    inviteCode: doc.inviteCode,
    partnerId: doc.partnerId,
    partnerPass: doc.partnerPass,
    resolved: doc.resolved,
    payout: doc.payout === undefined ? undefined : BigInt(doc.payout),
    outcome: doc.outcome,
    createdAt: doc.createdAt,
  }
}

export async function createVisit(input: {
  userId: number
  windowId: number
  place: string
  move: Move | null
  stake: bigint
  inviteCode?: string
}): Promise<VisitRecord | 'duplicate'> {
  try {
    const doc = await VisitModel.create({
      userId: input.userId,
      windowId: input.windowId,
      place: input.place,
      move: input.move ?? undefined,
      stake: input.stake,
      inviteCode: input.inviteCode,
    })
    return toRecord(doc.toObject())
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return 'duplicate'
    throw error
  }
}

export async function findVisit(userId: number, windowId: number): Promise<VisitRecord | null> {
  const doc = await VisitModel.findOne({ userId, windowId }).lean()
  return doc ? toRecord(doc) : null
}

export async function findUnresolvedVisits(windowId: number): Promise<VisitRecord[]> {
  const docs = await VisitModel.find({ windowId, resolved: false }).lean()
  return docs.map(toRecord)
}

export async function findWindowsToResolve(beforeWindowId: number): Promise<number[]> {
  const ids = await VisitModel.distinct('windowId', { windowId: { $lt: beforeWindowId }, resolved: false })
  return (ids as number[]).sort((a, b) => a - b)
}

export async function countVisitsByPlace(windowId: number): Promise<Record<string, number>> {
  const rows = await VisitModel.aggregate<{ _id: string, n: number }>([
    { $match: { windowId } },
    { $group: { _id: '$place', n: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map(r => [r._id, r.n]))
}

// Bind the joiner to the host's open invite. CAS on the host's visit so two
// joiners cannot both take it.
export async function bindInvite(
  windowId: number,
  place: string,
  inviteCode: string,
  joinerId: number,
): Promise<{ hostId: number } | 'expired' | 'taken'> {
  const host = await VisitModel.findOne({ windowId, place, inviteCode }).lean()
  if (!host) return 'expired'
  if (host.partnerId !== undefined || host.userId === joinerId) return 'taken'
  const bound = await VisitModel.findOneAndUpdate(
    { _id: host._id, partnerId: { $exists: false } },
    { $set: { partnerId: joinerId } },
    { new: true },
  ).lean()
  if (!bound) return 'taken'
  return { hostId: host.userId }
}

export async function setPartner(visitId: string, partnerId: number): Promise<void> {
  await VisitModel.updateOne({ _id: visitId }, { $set: { partnerId } })
}

export async function resolveVisitOnce(visitId: string, payout: bigint, outcome: string, partnerPass?: number): Promise<boolean> {
  const updated = await VisitModel.findOneAndUpdate(
    { _id: visitId, resolved: false },
    { $set: { resolved: true, payout, outcome, ...(partnerPass === undefined ? {} : { partnerPass }) } },
    { new: true },
  ).lean()
  return updated !== null
}

export async function findResolvedVisits(userId: number, limit: number): Promise<VisitRecord[]> {
  const docs = await VisitModel.find({ userId, resolved: true }).sort({ windowId: -1 }).limit(limit).lean()
  return docs.map(toRecord)
}

export async function lastResolvedVisit(userId: number): Promise<VisitRecord | null> {
  const [doc] = await findResolvedVisits(userId, 1)
  return doc ?? null
}
