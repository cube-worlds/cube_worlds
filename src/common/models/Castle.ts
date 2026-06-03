import type { DocumentType } from '@typegoose/typegoose'
import type { ResourceBag } from '#root/common/helpers/production'
import type { UserDoc } from './User'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

export const UPGRADE_TRACKS = ['walls', 'forge', 'tavern', 'mine'] as const
export type UpgradeTrack = (typeof UPGRADE_TRACKS)[number]

@modelOptions({ schemaOptions: { timestamps: true } })
export class Castle extends TimeStamps {
  @prop({ type: Number, required: true, unique: true, index: true })
  userId!: number

  @prop({ type: Number, required: true, default: 0 })
  walls!: number

  @prop({ type: Number, required: true, default: 0 })
  forge!: number

  @prop({ type: Number, required: true, default: 0 })
  tavern!: number

  @prop({ type: Number, required: true, default: 0 })
  mine!: number

  @prop({ type: Number, required: true, default: 0 })
  gold!: number

  @prop({ type: Number, required: true, default: 0 })
  iron!: number

  @prop({ type: Number, required: true, default: 0 })
  mana!: number

  @prop({ type: Number, required: true, default: 0 })
  food!: number

  @prop({ type: Date, required: true, default: () => new Date() })
  lastProductionAt!: Date

  @prop({ type: Boolean, required: true, default: false, index: true })
  nftMinted!: boolean

  @prop({ type: String })
  nftAddress?: string
}

const CastleModel = getModelForClass(Castle)

export { CastleModel }

// Atomic upsert — same E11000-recovery shape as findOrCreateEnergy.
export async function findOrCreateCastle(
  user: UserDoc,
): Promise<DocumentType<Castle>> {
  try {
    const castle = await CastleModel.findOneAndUpdate(
      { userId: user.id },
      { $setOnInsert: { userId: user.id, lastProductionAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    if (castle) return castle as DocumentType<Castle>
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err
  }
  const existing = await CastleModel.findOne({ userId: user.id })
  if (!existing) {
    throw new Error('Castle record disappeared after duplicate-key recovery')
  }
  return existing as DocumentType<Castle>
}

export function readBag(castle: Pick<Castle, 'gold' | 'iron' | 'mana' | 'food'>): ResourceBag {
  return { gold: castle.gold, iron: castle.iron, mana: castle.mana, food: castle.food }
}

export function addBags(a: ResourceBag, b: ResourceBag): ResourceBag {
  return {
    gold: a.gold + b.gold,
    iron: a.iron + b.iron,
    mana: a.mana + b.mana,
    food: a.food + b.food,
  }
}

// Returns the exact field-by-field difference. Intentionally does NOT floor at
// zero: callers that need affordability must check canAfford first, and the real
// overdraft guard is the $gte CAS in spendForUpgrade — not this helper. Do not
// add a Math.max(0, …) floor here.
export function subtractBags(a: ResourceBag, b: ResourceBag): ResourceBag {
  return {
    gold: a.gold - b.gold,
    iron: a.iron - b.iron,
    mana: a.mana - b.mana,
    food: a.food - b.food,
  }
}

export function canAfford(have: ResourceBag, cost: ResourceBag): boolean {
  return have.gold >= cost.gold
    && have.iron >= cost.iron
    && have.mana >= cost.mana
    && have.food >= cost.food
}

export const MAX_TRACK_LEVEL = 10

export interface UpgradeCost {
  cube: bigint
  resources: ResourceBag
}

// Per-track base cost at level 0; multiplied by (currentLevel + 1) per level.
const TRACK_BASE: Record<UpgradeTrack, UpgradeCost> = {
  walls: { cube: 500n, resources: { gold: 100, iron: 300, mana: 0, food: 0 } },
  forge: { cube: 500n, resources: { gold: 200, iron: 200, mana: 50, food: 0 } },
  tavern: { cube: 500n, resources: { gold: 300, iron: 0, mana: 0, food: 200 } },
  mine: { cube: 500n, resources: { gold: 200, iron: 100, mana: 0, food: 0 } },
}

export function upgradeCost(track: UpgradeTrack, currentLevel: number): UpgradeCost {
  if (currentLevel >= MAX_TRACK_LEVEL) {
    throw new Error(`Track ${track} is already at max level`)
  }
  const mult = currentLevel + 1
  const base = TRACK_BASE[track]
  return {
    cube: base.cube * BigInt(mult),
    resources: {
      gold: base.resources.gold * mult,
      iron: base.resources.iron * mult,
      mana: base.resources.mana * mult,
      food: base.resources.food * mult,
    },
  }
}

export function findUnmintedCastles(limit = 10) {
  return CastleModel.find({ nftMinted: false }).limit(limit)
}

export async function markCastleMinted(castleId: unknown, address: string): Promise<void> {
  await CastleModel.updateOne(
    { _id: castleId },
    { $set: { nftMinted: true, nftAddress: address } },
  )
}

// CAS: credit production + advance the clock ONLY if lastProductionAt still
// matches what the caller read. Serializes concurrent claims the same way
// persistClaimAtomic does on lastClaimDate — a lost race credits nothing.
export async function creditProduction(
  castleId: unknown,
  expectedLastProductionAt: Date,
  gained: ResourceBag,
  nextProductionAt: Date,
): Promise<boolean> {
  const result = await CastleModel.updateOne(
    { _id: castleId, lastProductionAt: expectedLastProductionAt },
    {
      $inc: { gold: gained.gold, iron: gained.iron, mana: gained.mana, food: gained.food },
      $set: { lastProductionAt: nextProductionAt },
    },
  )
  return result.modifiedCount === 1
}

// Atomic CAS debit of resources + increment of one upgrade track. The $gte
// guards make overdraft impossible (mirrors applyDebit in the wallet rail).
// Returns true only if the debit won.
export async function spendForUpgrade(
  castleId: unknown,
  cost: ResourceBag,
  track: UpgradeTrack,
): Promise<boolean> {
  if (!(UPGRADE_TRACKS as readonly string[]).includes(track)) {
    throw new Error(`Invalid upgrade track: ${track}`)
  }
  const result = await CastleModel.findOneAndUpdate(
    {
      _id: castleId,
      gold: { $gte: cost.gold },
      iron: { $gte: cost.iron },
      mana: { $gte: cost.mana },
      food: { $gte: cost.food },
    },
    {
      $inc: {
        gold: -cost.gold,
        iron: -cost.iron,
        mana: -cost.mana,
        food: -cost.food,
        [track]: 1,
      },
    },
    { new: false },
  )
  return result !== null
}

// Atomic generic resource debit (no track bump). $gte guards make overdraft
// impossible — the same CAS shape as spendForUpgrade / applyDebit. Returns true
// only if the debit won. Used by Tavern recruitment (Gold sink).
export async function spendResources(
  castleId: unknown,
  cost: ResourceBag,
): Promise<boolean> {
  const result = await CastleModel.findOneAndUpdate(
    {
      _id: castleId,
      gold: { $gte: cost.gold },
      iron: { $gte: cost.iron },
      mana: { $gte: cost.mana },
      food: { $gte: cost.food },
    },
    { $inc: { gold: -cost.gold, iron: -cost.iron, mana: -cost.mana, food: -cost.food } },
    { new: false },
  )
  return result !== null
}

// Credit resources to the castle (dungeon loot). Plain $inc — a faucet, no CAS
// needed; the exactly-once guarantee lives in the DungeonRun credited flip.
export async function creditResources(castleId: unknown, gain: ResourceBag): Promise<void> {
  await CastleModel.updateOne(
    { _id: castleId },
    { $inc: { gold: gain.gold, iron: gain.iron, mana: gain.mana, food: gain.food } },
  )
}
