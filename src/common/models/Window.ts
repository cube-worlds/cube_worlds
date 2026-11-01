import type { Gazette } from '#root/game/gazette'
import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose'

// Resolution lock per 8h window. Exists only so two resolver runs (overlapping
// ticks, a second process) cannot both pay a window — plus the window's public
// recap once it has been paid (see game/gazette.ts).
@modelOptions({ schemaOptions: { timestamps: true }, options: { allowMixed: Severity.ALLOW } })
class Window {
  @prop({ type: Number, required: true, unique: true })
  windowId!: number

  @prop({ type: String, required: true, default: 'open' })
  status!: 'open' | 'resolving' | 'resolved'

  // JSON-safe (amounts are strings). Overwritten if a window is resolved twice
  // (staging `/resolve` forcing the live window, then the natural tick).
  @prop({ type: Object })
  recap?: Gazette

  @prop({ type: Date })
  updatedAt?: Date
}

const WindowModel = getModelForClass(Window)

const STALE_RESOLVING_MS = 10 * 60 * 1000

export async function claimWindow(windowId: number, nowMs: number): Promise<boolean> {
  try {
    await WindowModel.updateOne({ windowId }, { $setOnInsert: { windowId, status: 'open' } }, { upsert: true })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }
  const claimed = await WindowModel.findOneAndUpdate(
    {
      windowId,
      $or: [
        { status: 'open' },
        { status: 'resolving', updatedAt: { $lt: new Date(nowMs - STALE_RESOLVING_MS) } },
      ],
    },
    { $set: { status: 'resolving' } },
    { new: true },
  ).lean()
  return claimed !== null
}

export async function markWindowResolved(windowId: number): Promise<void> {
  await WindowModel.updateOne({ windowId }, { $set: { status: 'resolved' } })
}

export async function markWindowOpen(windowId: number): Promise<void> {
  await WindowModel.updateOne({ windowId }, { $set: { status: 'open' } })
}

export async function setWindowRecap(windowId: number, recap: Gazette): Promise<void> {
  await WindowModel.updateOne({ windowId }, { $set: { recap } })
}

export async function findLatestRecap(): Promise<Gazette | null> {
  const doc = await WindowModel.findOne({ recap: { $exists: true } }).sort({ windowId: -1 }).lean()
  return (doc?.recap as Gazette | undefined) ?? null
}
