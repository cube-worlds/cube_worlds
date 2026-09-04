import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

// Resolution lock per 8h window. Exists only so two resolver runs (overlapping
// ticks, a second process) cannot both pay a window.
@modelOptions({ schemaOptions: { timestamps: true } })
class Window {
  @prop({ type: Number, required: true, unique: true })
  windowId!: number

  @prop({ type: String, required: true, default: 'open' })
  status!: 'open' | 'resolving' | 'resolved'

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
