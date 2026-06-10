import type { DocumentType, Ref } from '@typegoose/typegoose'
import type { Types } from 'mongoose'
import type { UserDoc } from './User'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { ClientError } from '#root/common/errors'
import { User } from './User'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const CLAIM_COOLDOWN_MS = 60 * 1000
const MAX_STREAK_DAYS = 10
const DAILY_BASE_REWARD = 100
const BASE_REWARD_PER_MS = DAILY_BASE_REWARD / ONE_DAY_MS

@modelOptions({ schemaOptions: { timestamps: true } })
export class Claim extends TimeStamps {
  // Unique per user — enforced by a Mongo index. Production deployments that
  // existed before this constraint must run ensureClaimUniquenessMigration()
  // first to dedupe; on fresh DBs Mongoose creates the index automatically.
  @prop({ ref: () => User, required: true, unique: true })
  user!: Ref<User>

  @prop({ type: Number, required: true, default: 0 })
  streakDays!: number

  @prop({ type: Number, required: true, default: 0 })
  lastClaimAmount!: number

  @prop({ type: Date, required: true, default: () => new Date(0) })
  lastClaimDate!: Date

  @prop({ type: Number, required: true, default: 0 })
  totalClaimed!: number

  @prop({ type: Number, required: true, default: 0 })
  fractionalCarry!: number
}

const ClaimModel = getModelForClass(Claim)

export { ClaimModel }

const CLAIM_DEFAULTS = {
  streakDays: 0,
  lastClaimAmount: 0,
  lastClaimDate: new Date(0),
  totalClaimed: 0,
  fractionalCarry: 0,
}

// Atomic upsert: returns the existing Claim or creates a fresh one. With the
// unique index on user, two concurrent first-claims will see exactly one
// insert succeed; the loser receives E11000 and re-reads to fetch the winner.
export async function findOrCreateClaim(
  user: UserDoc,
): Promise<DocumentType<Claim>> {
  try {
    const claim = await ClaimModel.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, ...CLAIM_DEFAULTS } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    if (claim) return claim as DocumentType<Claim>
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) {
      throw err
    }
  }
  const existing = await ClaimModel.findOne({ user: user._id })
  if (!existing) {
    throw new Error('Claim record disappeared after duplicate-key recovery')
  }
  return existing as DocumentType<Claim>
}

export function hasNeverClaimed(claim: DocumentType<Claim>): boolean {
  return (
    claim.lastClaimDate.getTime() <= 0
    && claim.streakDays === 0
    && claim.totalClaimed === 0
    && claim.fractionalCarry === 0
  )
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getClaimDayDelta(claim: DocumentType<Claim>, now: Date): number {
  const lastDay = startOfUtcDay(claim.lastClaimDate)
  const nowDay = startOfUtcDay(now)
  return Math.floor((nowDay.getTime() - lastDay.getTime()) / ONE_DAY_MS)
}

function getDisplayStreak(
  claim: DocumentType<Claim>,
  now: Date = new Date(),
): number {
  if (hasNeverClaimed(claim)) return 0
  if (getClaimDayDelta(claim, now) > 1) return 0
  return Math.min(Math.max(1, claim.streakDays), MAX_STREAK_DAYS)
}

function getClaimMultiplier(claim: DocumentType<Claim>, now: Date = new Date()): number {
  if (hasNeverClaimed(claim)) return 1

  const dayDelta = getClaimDayDelta(claim, now)
  const streak = Math.min(Math.max(1, claim.streakDays), MAX_STREAK_DAYS)
  if (dayDelta <= 0) return streak
  if (dayDelta === 1) return Math.min(streak + 1, MAX_STREAK_DAYS)
  return 1
}

function getRawClaimAmount(
  claim: DocumentType<Claim>,
  now: Date,
  multiplier: number,
): number {
  if (hasNeverClaimed(claim)) {
    return claim.fractionalCarry + (CLAIM_COOLDOWN_MS * BASE_REWARD_PER_MS * multiplier)
  }
  const elapsedMs = Math.max(0, now.getTime() - claim.lastClaimDate.getTime())
  return claim.fractionalCarry + (elapsedMs * BASE_REWARD_PER_MS * multiplier)
}

export function canClaimNow(
  claim: DocumentType<Claim>,
  now: Date = new Date(),
): boolean {
  if (hasNeverClaimed(claim)) return true
  const elapsed = now.getTime() - claim.lastClaimDate.getTime()
  return elapsed >= CLAIM_COOLDOWN_MS
}

export function getClaimStatus(
  claim: DocumentType<Claim>,
  now: Date = new Date(),
) {
  const neverClaimed = hasNeverClaimed(claim)
  const claimAvailable = canClaimNow(claim, now)
  const streakDays = getDisplayStreak(claim, now)
  const claimMultiplier = getClaimMultiplier(claim, now)
  const rawClaimAmount = getRawClaimAmount(claim, now, claimMultiplier)
  const elapsedMs = neverClaimed
    ? CLAIM_COOLDOWN_MS
    : now.getTime() - claim.lastClaimDate.getTime()
  const progressPercent = claimAvailable
    ? 100
    : Math.floor((Math.max(0, elapsedMs) / CLAIM_COOLDOWN_MS) * 100)
  const nextClaimDate = claimAvailable
    ? now
    : new Date(claim.lastClaimDate.getTime() + CLAIM_COOLDOWN_MS)
  const secondsUntilClaim = claimAvailable
    ? 0
    : Math.max(0, Math.ceil((CLAIM_COOLDOWN_MS - elapsedMs) / 1000))

  return {
    hasNeverClaimed: neverClaimed,
    canClaim: claimAvailable,
    streakDays,
    claimMultiplier,
    nextClaimAmount: Number(rawClaimAmount.toFixed(6)),
    rewardPerMinute: Number(
      ((DAILY_BASE_REWARD / 1440) * claimMultiplier).toFixed(6),
    ),
    rewardPerSecond: Number(
      ((DAILY_BASE_REWARD / ONE_DAY_MS) * 1000 * claimMultiplier).toFixed(8),
    ),
    fractionalCarry: Number(claim.fractionalCarry.toFixed(6)),
    secondsUntilClaim,
    nextClaimDate,
    progressPercent: Math.min(progressPercent, 100),
    lastClaimAmount: claim.lastClaimAmount,
    lastClaimDate: claim.lastClaimDate,
    totalClaimed: claim.totalClaimed,
  }
}

export interface ClaimUpdateFields {
  streakDays: number
  lastClaimAmount: number
  lastClaimDate: Date
  fractionalCarry: number
  totalClaimed: number
}

export type ClaimPersist = (
  claim: DocumentType<Claim>,
  expectedLastClaimDate: Date,
  update: ClaimUpdateFields,
) => Promise<boolean>

// Compare-and-swap on lastClaimDate. If another process updated the claim
// since we read it, the filter no longer matches and Mongo returns null —
// telling the caller it lost the race. This is the single source of truth
// for serializing concurrent claims across processes (no in-process lock
// is needed). The first-claim window is closed by the unique index on
// Claim.user plus ensureClaimUniquenessMigration().
const persistClaimAtomic: ClaimPersist = async (claim, expectedLastClaimDate, update) => {
  const result = await ClaimModel.findOneAndUpdate(
    { _id: claim._id, lastClaimDate: expectedLastClaimDate },
    { $set: update },
    { new: false },
  )
  return result !== null
}

export async function claimDaily(
  claim: DocumentType<Claim>,
  now: Date = new Date(),
  persist: ClaimPersist = persistClaimAtomic,
) {
  if (!canClaimNow(claim, now)) {
    throw new ClientError('Claim is not available yet')
  }

  const claimMultiplier = getClaimMultiplier(claim, now)
  const rawClaimAmount = getRawClaimAmount(claim, now, claimMultiplier)
  const claimAmount = Math.floor(rawClaimAmount)
  const fractionalCarry = Number((rawClaimAmount - claimAmount).toFixed(6))

  const previousLastClaimDate = claim.lastClaimDate
  const update: ClaimUpdateFields = {
    streakDays: claimMultiplier,
    lastClaimAmount: claimAmount,
    lastClaimDate: now,
    fractionalCarry,
    totalClaimed: claim.totalClaimed + claimAmount,
  }

  const won = await persist(claim, previousLastClaimDate, update)
  if (!won) {
    throw new ClientError('Claim is not available yet')
  }

  claim.streakDays = update.streakDays
  claim.lastClaimAmount = update.lastClaimAmount
  claim.lastClaimDate = update.lastClaimDate
  claim.fractionalCarry = update.fractionalCarry
  claim.totalClaimed = update.totalClaimed

  return {
    claimedAmount: claimAmount,
    rawClaimAmount: Number(rawClaimAmount.toFixed(6)),
    streakDays: claimMultiplier,
  }
}

// --- Migration: enforce one Claim per user ---

export interface ClaimMergeCandidate {
  _id: unknown
  streakDays: number
  lastClaimAmount: number
  lastClaimDate: Date
  totalClaimed: number
  fractionalCarry: number
}

export interface ClaimMergePlan {
  survivorId: unknown
  removedIds: unknown[]
  mergedFields: {
    streakDays: number
    lastClaimAmount: number
    lastClaimDate: Date
    totalClaimed: number
    fractionalCarry: number
  }
}

// Pure: given every Claim doc for one user, decide which to keep and what
// the consolidated fields should be. Survivor = most recent activity, ties
// broken by highest totalClaimed. totalClaimed + fractionalCarry are summed
// across all dupes (orphan first-claims contribute 0); streakDays takes the
// max. Tests target this function directly.
export function planClaimMerge(claims: ClaimMergeCandidate[]): ClaimMergePlan {
  if (claims.length === 0) {
    throw new Error('planClaimMerge requires at least one claim')
  }
  const sorted = [...claims].sort((a, b) => {
    const dateDiff = b.lastClaimDate.getTime() - a.lastClaimDate.getTime()
    if (dateDiff !== 0) return dateDiff
    return b.totalClaimed - a.totalClaimed
  })
  const survivor = sorted[0]
  const removed = sorted.slice(1)

  const totalClaimed = claims.reduce((sum, c) => sum + (c.totalClaimed || 0), 0)
  const fractionalCarry = Number(
    claims.reduce((sum, c) => sum + (c.fractionalCarry || 0), 0).toFixed(6),
  )
  const streakDays = claims.reduce(
    (max, c) => Math.max(max, c.streakDays || 0),
    0,
  )

  return {
    survivorId: survivor._id,
    removedIds: removed.map((c) => c._id),
    mergedFields: {
      streakDays,
      lastClaimAmount: survivor.lastClaimAmount,
      lastClaimDate: survivor.lastClaimDate,
      totalClaimed,
      fractionalCarry,
    },
  }
}

interface DuplicateGroup {
  _id: Types.ObjectId
  count: number
}

// Idempotent. Safe to call on every startup: when there are no duplicates
// and the index already exists, both steps short-circuit cheaply.
export async function ensureClaimUniquenessMigration(): Promise<{
  duplicateGroups: number
  removedDocs: number
}> {
  const groups = await ClaimModel.aggregate<DuplicateGroup>([
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ])

  let removedDocs = 0
  for (const group of groups) {
    const docs = await ClaimModel.find({ user: group._id })
    if (docs.length < 2) continue
    const plan = planClaimMerge(
      docs.map((d) => ({
        _id: d._id,
        streakDays: d.streakDays,
        lastClaimAmount: d.lastClaimAmount,
        lastClaimDate: d.lastClaimDate,
        totalClaimed: d.totalClaimed,
        fractionalCarry: d.fractionalCarry,
      })),
    )
    await ClaimModel.updateOne(
      { _id: plan.survivorId },
      { $set: plan.mergedFields },
    )
    if (plan.removedIds.length > 0) {
      const result = await ClaimModel.deleteMany({
        _id: { $in: plan.removedIds },
      })
      removedDocs += result.deletedCount ?? 0
    }
  }

  // Replace any pre-existing non-unique `user` index with the unique one.
  // Mongoose's startup auto-create may have failed silently if duplicates
  // were present, so handle the upgrade explicitly here.
  const indexes = await ClaimModel.collection.indexes()
  const userIndex = indexes.find((idx) => {
    const keys = Object.keys(idx.key)
    return keys.length === 1 && keys[0] === 'user'
  })
  if (userIndex && !userIndex.unique && userIndex.name) {
    await ClaimModel.collection.dropIndex(userIndex.name)
  }
  await ClaimModel.collection.createIndex({ user: 1 }, { unique: true })

  return { duplicateGroups: groups.length, removedDocs }
}
