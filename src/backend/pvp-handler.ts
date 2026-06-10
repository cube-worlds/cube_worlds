import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Stats } from '#root/common/helpers/hero'
import type { ResourceBag } from '#root/common/helpers/production'
import type { Castle } from '#root/common/models/Castle'
import type { Hero } from '#root/common/models/Hero'
import type { CreateMatchInput, MatchResolution, MatchSide } from '#root/common/models/Match'
import { ClientError } from '#root/common/errors'
import { resolveCombat } from '#root/common/helpers/combat'
import { dayBucket } from '#root/common/helpers/dungeon'
import { aggregateEquipment, withEquipment } from '#root/common/helpers/equipment'
import { applyXp, statsForHero } from '#root/common/helpers/hero'
import {
  ARENA_ENTRY_CUBE,
  ARENA_XP_LOSS,
  ARENA_XP_WIN,
  combatPower,
  eloDelta,
  matchSeed,
  RAID_FOOD_UPKEEP,
  RAID_LOOT_BPS,
  RAID_SHIELD_MS,
  RAID_STAKE_CUBE,
  RAIDS_PER_DAY,
  shieldActive,
  wallsBonus,
} from '#root/common/helpers/pvp'
import { BalanceChangeType } from '#root/common/models/Balance'
import { creditResources, findCastleByUserId, findOrCreateCastle, plunderResources, spendResources } from '#root/common/models/Castle'
import { findEquippedForHero } from '#root/common/models/Equipment'
import { findHeroesByUser, findHeroForUser, grantHeroXp } from '#root/common/models/Hero'
import { findActiveQuestForHero } from '#root/common/models/HeroQuest'
import {
  createPendingMatch,
  findPendingMatchByAttacker,
  findRecentMatches,
  recordMatchLoot,
  resolveMatchCas,
} from '#root/common/models/Match'
import {
  applyRatingDelta,
  claimRaidSlot,
  findOrCreatePvpProfile,
  releaseRaidSlot,
  setShield,
} from '#root/common/models/PvpProfile'
import { addResourceRecords, ResourceChangeType, ResourceKind } from '#root/common/models/ResourceLedger'
import { addPoints, debitVotes, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { findArenaOpponent, findRaidTarget } from './pvp-matchmaking'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, heroId?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type HeroDoc = Pick<DocumentType<Hero>, '_id' | 'userId' | 'heroClass' | 'level' | 'xp'>
interface GearRow { bonusHp: number, bonusAtk: number, bonusDef: number }
interface ProfileDoc { userId: number, rating: number, wins: number, losses: number, shieldUntil?: Date | null, raidDay: number, raidsToday: number }
interface MatchDoc {
  _id: unknown
  mode: 'arena' | 'raid'
  attackerId: number
  defenderId: number
  stake: number
  status: string
  attacker: MatchSide
  defender: MatchSide
  attackerWon?: boolean
  ratingDelta?: number
  xpGained?: number
  lootGold?: number
  lootIron?: number
  lootMana?: number
  lootFood?: number
  createdAt?: Date
}

export interface PvpHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findHeroForUser: (userId: number, heroId: string) => Promise<HeroDoc | null>
  findHeroesByUser: (userId: number) => Promise<HeroDoc[]>
  findEquippedForHero: (heroId: string) => Promise<GearRow[]>
  findActiveQuestForHero: (heroId: string) => Promise<{ _id: unknown } | null>
  findOrCreatePvpProfile: (userId: number) => Promise<ProfileDoc>
  findArenaOpponent: (attackerId: number, rating: number) => Promise<{ userId: number, rating: number } | null>
  findRaidTarget: (attackerId: number, rating: number, now: Date) => Promise<{ userId: number, rating: number } | null>
  findCastleByUserId: (userId: number) => Promise<Pick<DocumentType<Castle>, '_id' | 'walls'> | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  debitVotes: (userId: number, amount: bigint, reason: BalanceChangeType) => Promise<bigint | null>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  spendResources: (castleId: unknown, cost: ResourceBag) => Promise<boolean>
  plunderResources: (castleId: unknown, bps: number) => Promise<ResourceBag>
  creditResources: (castleId: unknown, gain: ResourceBag) => Promise<void>
  addResourceRecords: (userId: number, rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>) => Promise<void>
  claimRaidSlot: (userId: number, day: number) => Promise<boolean>
  releaseRaidSlot: (userId: number, day: number) => Promise<void>
  setShield: (userId: number, until: Date) => Promise<void>
  applyRatingDelta: (userId: number, delta: number, won: boolean) => Promise<void>
  createPendingMatch: (input: CreateMatchInput) => Promise<MatchDoc>
  findPendingMatchByAttacker: (attackerId: number) => Promise<MatchDoc | null>
  resolveMatchCas: (matchId: unknown, result: MatchResolution) => Promise<boolean>
  recordMatchLoot: (matchId: unknown, loot: ResourceBag) => Promise<void>
  findRecentMatches: (userId: number, limit: number) => Promise<MatchDoc[]>
  grantHeroXp: (heroId: string, xp: number, level: number) => Promise<void>
  now: () => Date
  logError: (message: string) => void
}

function createDefaultDependencies(): PvpHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findHeroForUser: (userId, heroId) => findHeroForUser(userId, heroId) as never,
    findHeroesByUser: userId => findHeroesByUser(userId) as never,
    findEquippedForHero: heroId => findEquippedForHero(heroId) as never,
    findActiveQuestForHero: heroId => findActiveQuestForHero(heroId) as never,
    findOrCreatePvpProfile: userId => findOrCreatePvpProfile(userId) as never,
    findArenaOpponent,
    findRaidTarget,
    findCastleByUserId: userId => findCastleByUserId(userId) as never,
    findOrCreateCastle,
    debitVotes,
    addPoints,
    spendResources,
    plunderResources,
    creditResources,
    addResourceRecords,
    claimRaidSlot,
    releaseRaidSlot,
    setShield,
    applyRatingDelta,
    createPendingMatch: input => createPendingMatch(input) as never,
    findPendingMatchByAttacker: attackerId => findPendingMatchByAttacker(attackerId) as never,
    resolveMatchCas,
    recordMatchLoot,
    findRecentMatches: (userId, limit) => findRecentMatches(userId, limit) as never,
    grantHeroXp,
    now: () => new Date(),
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: PvpHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const statusSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const fightSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, heroId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const

const ZERO_BAG: ResourceBag = { gold: 0, iron: 0, mana: 0, food: 0 }

function sideStats(side: MatchSide) {
  return { hp: side.hp, atk: side.atk, def: side.def }
}

function lootRows(loot: ResourceBag, sign: 1 | -1) {
  return [
    { kind: ResourceKind.Gold, amount: sign * loot.gold, type: ResourceChangeType.Raid },
    { kind: ResourceKind.Iron, amount: sign * loot.iron, type: ResourceChangeType.Raid },
    { kind: ResourceKind.Mana, amount: sign * loot.mana, type: ResourceChangeType.Raid },
    { kind: ResourceKind.Food, amount: sign * loot.food, type: ResourceChangeType.Raid },
  ]
}

// Effective combatant: hero base stats + equipped gear; a raid defender also
// gets the walls bonus. The pure resolveCombat stays untouched — buffs are
// summed upstream (the Plan 6 discipline).
async function effectiveStats(hero: HeroDoc, deps: PvpHandlerDependencies, wallsLevel = 0): Promise<Stats> {
  const gear = await deps.findEquippedForHero(String(hero._id))
  const bonus = aggregateEquipment(gear.map(g => ({ hp: g.bonusHp, atk: g.bonusAtk, def: g.bonusDef })))
  const base = withEquipment(statsForHero(hero.heroClass, hero.level), bonus)
  return wallsLevel > 0 ? wallsBonus(base, wallsLevel) : base
}

// The defender's STRONGEST hero defends (best effective stats incl. gear). A
// snapshot can always defend — defender occupancy is intentionally ignored.
async function buildDefenderSide(
  userId: number,
  rating: number,
  wallsLevel: number,
  deps: PvpHandlerDependencies,
): Promise<MatchSide | null> {
  const heroes = await deps.findHeroesByUser(userId)
  if (heroes.length === 0) return null
  let best: { hero: HeroDoc, stats: Stats } | null = null
  for (const hero of heroes) {
    const stats = await effectiveStats(hero, deps, wallsLevel)
    if (!best || combatPower(stats) > combatPower(best.stats)) best = { hero, stats }
  }
  if (!best) return null
  const owner = await deps.findUserById(userId)
  return {
    userId,
    name: owner?.name ?? 'Player',
    heroId: String(best.hero._id),
    heroClass: best.hero.heroClass,
    level: best.hero.level,
    rating,
    hp: best.stats.hp,
    atk: best.stats.atk,
    def: best.stats.def,
  }
}

async function buildAttackerSide(
  user: ExistingUser,
  hero: HeroDoc,
  rating: number,
  deps: PvpHandlerDependencies,
): Promise<MatchSide> {
  const stats = await effectiveStats(hero, deps)
  return {
    userId: user.id,
    name: user.name ?? 'Player',
    heroId: String(hero._id),
    heroClass: hero.heroClass,
    level: hero.level,
    rating,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
  }
}

interface Settled {
  attackerWon: boolean
  rounds: ReturnType<typeof resolveCombat>['rounds']
  ratingDelta: number
  xpGained: number
  loot: ResourceBag
}

// The single resolve path for both modes and for crash-stranded sweeps.
// Deterministic: seed and ratings come from the stored match, so a re-run
// computes the identical outcome; the status CAS makes credit exactly-once.
// Credit ordering mirrors the dungeon: CAS first, side effects after — a crash
// in between loses credits (false-loss), never double-pays.
async function settleMatch(match: MatchDoc, deps: PvpHandlerDependencies): Promise<Settled> {
  const seed = matchSeed(String(match._id))
  const result = resolveCombat(seed, sideStats(match.attacker), sideStats(match.defender))
  const attackerWon = result.win
  const ratingDelta = eloDelta(match.attacker.rating, match.defender.rating, attackerWon)
  const xpGained = match.mode === 'arena' ? (attackerWon ? ARENA_XP_WIN : ARENA_XP_LOSS) : 0
  let loot: ResourceBag = ZERO_BAG

  const won = await deps.resolveMatchCas(match._id, { seed, attackerWon, ratingDelta, xpGained })
  if (!won) return { attackerWon, rounds: result.rounds, ratingDelta, xpGained, loot }

  await deps.applyRatingDelta(match.attackerId, ratingDelta, attackerWon)
  await deps.applyRatingDelta(match.defenderId, -ratingDelta, !attackerWon)

  if (match.mode === 'arena') {
    const hero = await deps.findHeroForUser(match.attackerId, match.attacker.heroId)
    if (hero) {
      const xp = applyXp(hero.xp, hero.level, xpGained)
      await deps.grantHeroXp(match.attacker.heroId, xp.xp, xp.level)
    }
  } else if (attackerWon) {
    // Stake comes back on a win — only a LOST raid burns it.
    await deps.addPoints(match.attackerId, BigInt(match.stake), BalanceChangeType.RaidStake)
    const defenderCastle = await deps.findCastleByUserId(match.defenderId)
    if (defenderCastle) {
      loot = await deps.plunderResources(defenderCastle._id, RAID_LOOT_BPS)
      const attackerCastle = await deps.findCastleByUserId(match.attackerId)
      if (attackerCastle) await deps.creditResources(attackerCastle._id, loot)
      await deps.addResourceRecords(match.defenderId, lootRows(loot, -1))
      await deps.addResourceRecords(match.attackerId, lootRows(loot, 1))
      await deps.recordMatchLoot(match._id, loot)
    }
    // Shield only on a SUCCESSFUL raid — the defender lost resources.
    await deps.setShield(match.defenderId, new Date(deps.now().getTime() + RAID_SHIELD_MS))
  }

  return { attackerWon, rounds: result.rounds, ratingDelta, xpGained, loot }
}

// Resolve a crash-stranded pending match before any new PvP action. Errors are
// logged, never surfaced — the stranded match will be retried next request.
async function sweepPending(userId: number, deps: PvpHandlerDependencies): Promise<void> {
  try {
    const pending = await deps.findPendingMatchByAttacker(userId)
    if (pending) await settleMatch(pending, deps)
  } catch (err) {
    deps.logError(`pvp pending sweep failed for ${userId}: ${err}`)
  }
}

function matchView(m: MatchDoc, userId: number) {
  const youAttacked = m.attackerId === userId
  const resolved = m.status === 'resolved'
  const opponent = youAttacked ? m.defender : m.attacker
  return {
    id: String(m._id),
    mode: m.mode,
    youAttacked,
    youWon: resolved ? (youAttacked ? m.attackerWon : !m.attackerWon) : null,
    ratingDelta: resolved && m.ratingDelta !== undefined ? (youAttacked ? m.ratingDelta : -m.ratingDelta) : null,
    opponent: { name: opponent.name, heroClass: opponent.heroClass, level: opponent.level },
    loot: { gold: m.lootGold ?? 0, iron: m.lootIron ?? 0, mana: m.lootMana ?? 0, food: m.lootFood ?? 0 },
    at: m.createdAt ?? null,
  }
}

export function buildPvpHandler(deps: PvpHandlerDependencies = createDefaultDependencies()) {
  return async function pvpHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/pvp', statusSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        await sweepPending(user.id, deps)
        const profile = await deps.findOrCreatePvpProfile(user.id)
        const now = deps.now()
        const day = dayBucket(now)
        const raidsUsed = profile.raidDay === day ? profile.raidsToday : 0
        const matches = await deps.findRecentMatches(user.id, 20)
        return {
          rating: profile.rating,
          wins: profile.wins,
          losses: profile.losses,
          shieldUntil: shieldActive(profile.shieldUntil, now) ? profile.shieldUntil : null,
          raidsLeft: Math.max(0, RAIDS_PER_DAY - raidsUsed),
          arenaEntryCube: ARENA_ENTRY_CUBE.toString(),
          raidStakeCube: RAID_STAKE_CUBE.toString(),
          raidFoodUpkeep: RAID_FOOD_UPKEEP,
          matches: matches.map(m => matchView(m, user.id)),
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/arena/fight', fightSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, heroId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!heroId) return { error: 'No heroId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const hero = await deps.findHeroForUser(user.id, heroId)
        if (!hero) return { error: 'Hero not found' }
        const onQuest = await deps.findActiveQuestForHero(String(hero._id))
        if (onQuest) return { error: 'Hero is away on a quest' }

        await sweepPending(user.id, deps)
        const profile = await deps.findOrCreatePvpProfile(user.id)

        // Entry fee is a 100% burn — debit first, refund only if matchmaking
        // comes up empty (the recruit-handler refund-on-loss discipline).
        const balance = await deps.debitVotes(user.id, ARENA_ENTRY_CUBE, BalanceChangeType.ArenaEntry)
        if (balance === null) return { error: 'Not enough CUBE' }

        const opponent = await deps.findArenaOpponent(user.id, profile.rating)
        const defender = opponent ? await buildDefenderSide(opponent.userId, opponent.rating, 0, deps) : null
        if (!opponent || !defender) {
          await deps.addPoints(user.id, ARENA_ENTRY_CUBE, BalanceChangeType.ArenaEntry)
          return { error: 'No opponent found' }
        }

        const attacker = await buildAttackerSide(user, hero, profile.rating, deps)
        const match = await deps.createPendingMatch({
          mode: 'arena',
          attackerId: user.id,
          defenderId: opponent.userId,
          stake: 0,
          attacker,
          defender,
        })
        const settled = await settleMatch(match, deps)
        return {
          mode: 'arena',
          win: settled.attackerWon,
          rounds: settled.rounds,
          ratingDelta: settled.ratingDelta,
          xpGained: settled.xpGained,
          opponent: { name: defender.name, heroClass: defender.heroClass, level: defender.level },
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    // Task 9 inserts the /raid/attack route here.
  }
}

const pvpHandler = buildPvpHandler()

export default pvpHandler
