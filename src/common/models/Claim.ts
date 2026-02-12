import type { DocumentType, Ref } from '@typegoose/typegoose'
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
  user: DocumentType<User>,
): Promise<DocumentType<Claim>> {
  const existingClaim = await ClaimModel.findOne({ user: user._id })
  if (existingClaim) {
    return existingClaim as DocumentType<Claim>
  }

  const createdClaim = new ClaimModel({ user })
  return createdClaim.save() as Promise<DocumentType<Claim>>
}

function hasNeverClaimed(claim: DocumentType<Claim>): boolean {
  return (
    claim.lastClaimDate.getTime() <= 0
    && claim.streakDays === 0
    && claim.totalClaimed === 0
    && claim.fractionalCarry === 0
  )
}

function startOfUtcDay(date: Date): Date {
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

export async function claimDaily(
  claim: DocumentType<Claim>,
  now: Date = new Date(),
) {
  if (!canClaimNow(claim, now)) {
    throw new Error('Claim is not available yet')
  }

  const claimMultiplier = getClaimMultiplier(claim, now)
  const rawClaimAmount = getRawClaimAmount(claim, now, claimMultiplier)
  const claimAmount = Math.floor(rawClaimAmount)
  const fractionalCarry = Number((rawClaimAmount - claimAmount).toFixed(6))

  claim.streakDays = claimMultiplier
  claim.lastClaimAmount = claimAmount
  claim.lastClaimDate = now
  claim.fractionalCarry = fractionalCarry
  claim.totalClaimed += claimAmount
  await claim.save()

  return {
    claimedAmount: claimAmount,
    rawClaimAmount: Number(rawClaimAmount.toFixed(6)),
    streakDays: claimMultiplier,
  }
}
