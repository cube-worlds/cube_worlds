import type { DocumentType } from '@typegoose/typegoose'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './User'

@modelOptions({ schemaOptions: { timestamps: true } })
export class Claim extends TimeStamps {
  @prop({ ref: () => User, required: true })
  user!: User

  @prop({ type: Number, required: true, default: 0 })
  lastClaimAmount!: number

  @prop({ type: Date, required: true, default: () => new Date(0) })
  lastClaimDate!: Date

  @prop({ type: Number, required: true, default: 0 })
  totalClaimed!: number
}

const ClaimModel = getModelForClass(Claim)

export async function findOrCreateClaim(user: DocumentType<User>) {
  return ClaimModel.findOneAndUpdate(
    { user: user._id },
    {},
    { upsert: true, new: true },
  )
}

export async function calculateClaimAmount(
  claim: DocumentType<Claim>,
): Promise<number> {
  const now = new Date()
  const lastClaim = claim.lastClaimDate
  const timeDiff = now.getTime() - lastClaim.getTime()
  const hoursPassed = timeDiff / (1000 * 60 * 60)

  // Maximum claim time is 8 hours
  const maxHours = 8
  const effectiveHours = Math.min(hoursPassed, maxHours)

  // Base claim rate is 10 CUBE per hour
  const baseRate = 10
  const claimAmount = Math.floor(effectiveHours * baseRate)

  return claimAmount
}

export async function canClaim(claim: DocumentType<Claim>): Promise<boolean> {
  const now = new Date()
  const lastClaim = claim.lastClaimDate
  const timeDiff = now.getTime() - lastClaim.getTime()
  // Can claim if:
  // 1. At least 1 minute has passed
  // 2. Claim amount would be more than 10 CUBE
  const minTime = 60 * 1000 // 1 minute in milliseconds
  const claimAmount = await calculateClaimAmount(claim)

  return timeDiff >= minTime && claimAmount >= 10
}
