import { RATING_START } from '#root/common/helpers/pvp'
import { CastleModel } from '#root/common/models/Castle'
import { HeroModel } from '#root/common/models/Hero'
import { PvpProfileModel } from '#root/common/models/PvpProfile'

export interface Opponent {
  userId: number
  rating: number
}

// Widening rating windows: ±100 → ±300 → anyone rated.
const WINDOWS = [100, 300, Number.POSITIVE_INFINITY]

async function sampleProfile(filter: Record<string, unknown>): Promise<Opponent | null> {
  const [pick] = await PvpProfileModel.aggregate<{ userId: number, rating: number }>([
    { $match: filter },
    { $sample: { size: 1 } },
  ])
  return pick ? { userId: pick.userId, rating: pick.rating } : null
}

// Any other user who owns a hero, treated as unrated (1000). Cold-start path so
// the very first arena fight in a fresh deployment can still find someone.
async function sampleHeroOwner(attackerId: number): Promise<Opponent | null> {
  const [pick] = await HeroModel.aggregate<{ _id: number }>([
    { $match: { userId: { $ne: attackerId } } },
    { $group: { _id: '$userId' } },
    { $sample: { size: 1 } },
  ])
  return pick ? { userId: pick._id, rating: RATING_START } : null
}

async function ownsCastleAndHero(userId: number): Promise<boolean> {
  if (!(await CastleModel.exists({ userId }))) return false
  return (await HeroModel.exists({ userId })) !== null
}

export async function findArenaOpponent(attackerId: number, rating: number): Promise<Opponent | null> {
  for (const w of WINDOWS) {
    const filter: Record<string, unknown> = { userId: { $ne: attackerId } }
    if (Number.isFinite(w)) filter.rating = { $gte: rating - w, $lte: rating + w }
    const pick = await sampleProfile(filter)
    // A rated profile alone isn't enough — opening the PvP tab creates one.
    // Only a hero owner can defend; fall through to a wider window otherwise.
    if (pick && (await HeroModel.exists({ userId: pick.userId })) !== null) return pick
  }
  return sampleHeroOwner(attackerId)
}

// Raid targets must be unshielded and own a castle + a hero (there must be
// something to plunder and someone to defend it).
export async function findRaidTarget(attackerId: number, rating: number, now: Date): Promise<Opponent | null> {
  const unshielded = {
    $or: [{ shieldUntil: { $exists: false } }, { shieldUntil: null }, { shieldUntil: { $lte: now } }],
  }
  for (const w of WINDOWS) {
    const filter: Record<string, unknown> = { userId: { $ne: attackerId }, ...unshielded }
    if (Number.isFinite(w)) filter.rating = { $gte: rating - w, $lte: rating + w }
    const pick = await sampleProfile(filter)
    if (pick && (await ownsCastleAndHero(pick.userId))) return pick
  }
  // Cold start: sample a few hero owners; shieldless by definition (no profile).
  for (let i = 0; i < 3; i++) {
    const pick = await sampleHeroOwner(attackerId)
    if (!pick) return null
    const profile = await PvpProfileModel.findOne({ userId: pick.userId })
    const isShielded = !!profile?.shieldUntil && profile.shieldUntil.getTime() > now.getTime()
    if (!isShielded && (await ownsCastleAndHero(pick.userId))) {
      return { userId: pick.userId, rating: profile?.rating ?? RATING_START }
    }
  }
  return null
}
