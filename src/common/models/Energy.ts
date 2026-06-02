import type { DocumentType, Ref } from '@typegoose/typegoose'
import type { UserDoc } from './User'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { ClientError } from '#root/common/errors'
import { ENERGY_MAX, regenEnergy } from '#root/common/helpers/energy'
import { energyCapFor } from './SeasonPass'
import { User } from './User'

@modelOptions({ schemaOptions: { timestamps: true } })
export class Energy extends TimeStamps {
  @prop({ ref: () => User, required: true, unique: true, index: true })
  user!: Ref<User>

  @prop({ type: Number, required: true, default: ENERGY_MAX })
  current!: number

  @prop({ type: Date, required: true, default: () => new Date() })
  regenAt!: Date
}

const EnergyModel = getModelForClass(Energy)

export { EnergyModel }

// regenAt is set inline at insert time (not here) so the timestamp reflects
// the moment of creation, never module-load time.
const ENERGY_DEFAULTS = {
  current: ENERGY_MAX,
}

// Atomic upsert — same E11000-recovery shape as findOrCreateClaim.
export async function findOrCreateEnergy(
  user: UserDoc,
): Promise<DocumentType<Energy>> {
  try {
    const energy = await EnergyModel.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, ...ENERGY_DEFAULTS, regenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    if (energy) return energy as DocumentType<Energy>
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err
  }
  const existing = await EnergyModel.findOne({ user: user._id })
  if (!existing) {
    throw new Error('Energy record disappeared after duplicate-key recovery')
  }
  return existing as DocumentType<Energy>
}

export function getEnergyStatus(
  energy: DocumentType<Energy>,
  now: Date = new Date(),
  cap: number = ENERGY_MAX,
) {
  // Never clamp a balance already above the base cap (a season-pass holder who
  // stockpiled past 120): the effective cap is at least the stored balance.
  const effectiveCap = Math.max(cap, energy.current)
  const regen = regenEnergy(energy.current, energy.regenAt, now, effectiveCap)
  return {
    current: regen.current,
    max: effectiveCap,
    regenAt: regen.regenAt,
  }
}

export interface EnergyUpdateFields {
  current: number
  regenAt: Date
}

export type EnergyPersist = (
  energy: DocumentType<Energy>,
  expectedRegenAt: Date,
  update: EnergyUpdateFields,
) => Promise<boolean>

// Compare-and-swap on regenAt: serializes concurrent spends per user the same
// way persistClaimAtomic does on lastClaimDate.
const persistEnergyAtomic: EnergyPersist = async (energy, expectedRegenAt, update) => {
  const result = await EnergyModel.findOneAndUpdate(
    { _id: energy._id, regenAt: expectedRegenAt },
    { $set: update },
    { new: false },
  )
  return result !== null
}

// Deducts `amount` energy after regenerating. Throws ClientError if the
// regenerated balance is insufficient or the CAS is lost.
export async function spendEnergy(
  energy: DocumentType<Energy>,
  amount: number,
  now: Date = new Date(),
  persist: EnergyPersist = persistEnergyAtomic,
  cap: number = ENERGY_MAX,
): Promise<EnergyUpdateFields> {
  // max(cap, current) so a season-pass holder above the base cap never has
  // their stockpiled energy clamped away by the regen step.
  const regen = regenEnergy(energy.current, energy.regenAt, now, Math.max(cap, energy.current))
  if (regen.current < amount) {
    throw new ClientError('Not enough energy')
  }
  const previousRegenAt = energy.regenAt
  const update: EnergyUpdateFields = {
    current: regen.current - amount,
    regenAt: regen.regenAt,
  }
  const won = await persist(energy, previousRegenAt, update)
  if (!won) {
    throw new ClientError('Energy changed, please retry')
  }
  energy.current = update.current
  energy.regenAt = update.regenAt
  return update
}

// Grants energy (capped) — used by the CUBE-refill sink. Best-effort, not
// part of the spend CAS.
export async function grantEnergy(
  user: UserDoc,
  amount: number,
  now: Date = new Date(),
  cap?: number,
): Promise<number> {
  // grantEnergy holds the full UserDoc, so it self-resolves the season-pass cap
  // when one isn't passed — every caller (refill, buy-energy, ad-reward) gets the
  // elevated ceiling for free, with no wiring change.
  const effectiveCap = cap ?? (await energyCapFor(user.id, now))
  const energy = await findOrCreateEnergy(user)
  const regen = regenEnergy(energy.current, energy.regenAt, now, Math.max(effectiveCap, energy.current))
  const next = Math.min(effectiveCap, regen.current + amount)
  await EnergyModel.updateOne(
    { _id: energy._id },
    { $set: { current: next, regenAt: regen.regenAt } },
  )
  return next
}
