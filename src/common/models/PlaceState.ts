import { getModelForClass, prop } from '@typegoose/typegoose'

// Persistent per-place state — every place's treasury (see docs/BALI_SPEC.md).
class PlaceState {
  @prop({ type: String, required: true, unique: true })
  place!: string

  @prop({ type: BigInt, required: true })
  pool!: bigint

  @prop({ type: Number, default: 0 })
  lastWindow!: number
}

const PlaceStateModel = getModelForClass(PlaceState)

export async function getPool(place: string, seed: bigint): Promise<bigint> {
  const doc = await PlaceStateModel.findOneAndUpdate(
    { place },
    { $setOnInsert: { place, pool: seed } },
    { upsert: true, new: true },
  ).lean()
  return BigInt(doc!.pool)
}

// Read-only bulk read for /api/world/state, which needs all 14 treasuries at
// once — getPool upserts, and 14 upserts per request on a 60/min route is not
// worth it just to show a number. A place with no document yet is simply absent
// and the caller falls back to its seed.
export async function getPools(): Promise<Map<string, bigint>> {
  const docs = await PlaceStateModel.find({}, { place: 1, pool: 1 }).lean()
  return new Map(docs.map(d => [d.place, BigInt(d.pool)]))
}

// CAS on lastWindow so a resolver retry for a window that already committed
// this place's pool cannot re-apply the same growth/collapse a second time.
// Returns whether this call was the one that actually wrote the pool.
export async function setPool(place: string, pool: bigint, windowId: number): Promise<boolean> {
  const result = await PlaceStateModel.updateOne(
    { place, lastWindow: { $ne: windowId } },
    { $set: { pool, lastWindow: windowId } },
    { upsert: true },
  )
  return result.modifiedCount > 0 || result.upsertedCount > 0
}
