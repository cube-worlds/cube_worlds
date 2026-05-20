import type { DocumentType, Ref } from '@typegoose/typegoose'
import type { UserDoc } from './User'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './User'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const CLAIM_COOLDOWN_MS = 60 * 1000
const MAX_STREAK_DAYS = 10
const DAILY_BASE_REWARD = 100
const BASE_REWARD_PER_MS = DAILY_BASE_REWARD / ONE_DAY_MS

@modelOptions({ schemaOptions: { timestamps: true } })
export class Claim extends TimeStamps {
  @prop({ ref: () => User, required: true })
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

export async function findOrCreateClaim(
  user: UserDoc,
): Promise<DocumentType<Claim>> {
  const existingClaim = await ClaimModel.findOne({ user: user._id })
  if (existingClaim) {
    return existingClaim as DocumentType<Claim>
  }

  const createdClaim = new ClaimModel({ user })
  return createdClaim.save() as Promise<DocumentType<Claim>>
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
// is needed). The first-claim window between findOrCreateClaim's findOne
// and its save is still a small race; a unique index on Claim.user would
// close it, but is intentionally out of scope here.
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
    throw new Error('Claim is not available yet')
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
    throw new Error('Claim is not available yet')
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
