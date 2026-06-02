import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

// Fixed CUBE pool per world per tick. This is the bounded faucet knob: total
// CUBE minted per tick = POOL_PER_WORLD × number of non-empty worlds.
export const POOL_PER_WORLD = 5000

export interface WorldDef {
  worldId: string
  name: string
}

export const WORLD_DEFS: WorldDef[] = [
  { worldId: 'frostvault', name: 'Frostvault' },
  { worldId: 'emberwild', name: 'Emberwild' },
  { worldId: 'sunken-cube', name: 'Sunken Cube' },
  { worldId: 'verdant-maze', name: 'Verdant Maze' },
  { worldId: 'storm-spire', name: 'Storm Spire' },
]

// Compound unique index so a (tick, world) pair can only be seeded once and
// concurrent seeders collide on E11000 rather than duplicating. Declared at
// schema level so Mongoose surfaces creation errors through the normal boot
// flow rather than swallowing them.
@index({ tickId: 1, worldId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true } })
export class World extends TimeStamps {
  @prop({ type: Number, required: true, index: true })
  tickId!: number

  @prop({ type: String, required: true })
  worldId!: string

  @prop({ type: String, required: true })
  name!: string

  @prop({ type: Number, required: true })
  cubePool!: number

  @prop({ type: Number, required: true, default: 0 })
  totalWeight!: number

  @prop({ type: Number, required: true, default: 0 })
  explorerCount!: number

  @prop({ type: Boolean, required: true, default: false, index: true })
  settled!: boolean
}

const WorldModel = getModelForClass(World)

export { WorldModel }

export interface WorldSeedDoc {
  tickId: number
  worldId: string
  name: string
  cubePool: number
  totalWeight: number
  explorerCount: number
  settled: boolean
}

export function worldSeedDocs(tickId: number): WorldSeedDoc[] {
  return WORLD_DEFS.map((def) => ({
    tickId,
    worldId: def.worldId,
    name: def.name,
    cubePool: POOL_PER_WORLD,
    totalWeight: 0,
    explorerCount: 0,
    settled: false,
  }))
}

// Idempotent: safe to call every tick / on startup. Uses an unordered bulk
// upsert keyed on (tickId, worldId); already-seeded worlds are no-ops.
export async function ensureWorldsForTick(tickId: number): Promise<void> {
  const docs = worldSeedDocs(tickId)
  await WorldModel.bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { tickId: doc.tickId, worldId: doc.worldId },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    })),
    { ordered: false },
  )
}

export function findWorldsForTick(tickId: number) {
  return WorldModel.find({ tickId }).sort({ worldId: 1 })
}

// Atomic crowd-counter bump when an expedition commits to a world.
export async function addWorldCommitment(
  tickId: number,
  worldId: string,
  weight: number,
): Promise<void> {
  await WorldModel.updateOne(
    { tickId, worldId },
    { $inc: { totalWeight: weight, explorerCount: 1 } },
  )
}

// All unsettled worlds for closed ticks (tickId < currentTick), oldest first.
export function findUnsettledWorlds(currentTickId: number) {
  return WorldModel.find({ settled: false, tickId: { $lt: currentTickId } }).sort({
    tickId: 1,
    worldId: 1,
  })
}

export async function markWorldSettled(tickId: number, worldId: string): Promise<void> {
  await WorldModel.updateOne({ tickId, worldId }, { $set: { settled: true } })
}
