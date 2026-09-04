import { getModelForClass, prop } from '@typegoose/typegoose'

// Persistent per-place state — today only the commons pools.
class PlaceState {
  @prop({ type: String, required: true, unique: true })
  place!: string

  @prop({ type: BigInt, required: true })
  pool!: bigint
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

export async function setPool(place: string, pool: bigint): Promise<void> {
  await PlaceStateModel.updateOne({ place }, { $set: { pool } }, { upsert: true })
}
