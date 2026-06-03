import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { ResourceBag } from '#root/common/helpers/production'
import type { Castle } from '#root/common/models/Castle'
import type { Hero } from '#root/common/models/Hero'
import { ClientError } from '#root/common/errors'
import { resolveCombat } from '#root/common/helpers/combat'
import { dayBucket, DUNGEON_XP_LOSS, DUNGEON_XP_WIN, dungeonEnemy, dungeonLoot, dungeonSeed } from '#root/common/helpers/dungeon'
import { aggregateEquipment, withEquipment } from '#root/common/helpers/equipment'
import { applyXp, statsForHero } from '#root/common/helpers/hero'
import { creditResources, findOrCreateCastle } from '#root/common/models/Castle'
import { claimDungeonCredit, claimDungeonRun, findDungeonRun } from '#root/common/models/DungeonRun'
import { findEquippedForHero } from '#root/common/models/Equipment'
import { findHeroForUser, grantHeroXp } from '#root/common/models/Hero'
import { addResourceRecords, ResourceChangeType, ResourceKind } from '#root/common/models/ResourceLedger'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, heroId?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type HeroDoc = Pick<DocumentType<Hero>, '_id' | 'userId' | 'heroClass' | 'level' | 'xp'>

export interface DungeonHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  findHeroForUser: (userId: number, heroId: string) => Promise<HeroDoc | null>
  findEquippedForHero: (heroId: string) => Promise<Array<{ bonusHp: number, bonusAtk: number, bonusDef: number }>>
  now: () => Date
  findDungeonRun: (userId: number, day: number) => Promise<{ win: boolean, lootGold: number } | null>
  claimDungeonRun: (input: { userId: number, day: number, heroId: string, seed: number, win: boolean, loot: ResourceBag, xpGained: number }) => Promise<{ _id: unknown } | null>
  claimDungeonCredit: (runId: unknown) => Promise<boolean>
  creditResources: (castleId: unknown, gain: ResourceBag) => Promise<void>
  addResourceRecords: (userId: number, rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>) => Promise<void>
  grantHeroXp: (heroId: string, xp: number, level: number) => Promise<void>
  logError: (message: string) => void
}

function createDefaultDependencies(): DungeonHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateCastle,
    findHeroForUser: (userId, heroId) => findHeroForUser(userId, heroId) as never,
    findEquippedForHero: heroId => findEquippedForHero(heroId) as never,
    now: () => new Date(),
    findDungeonRun: (userId, day) => findDungeonRun(userId, day) as never,
    claimDungeonRun: input => claimDungeonRun(input) as never,
    claimDungeonCredit,
    creditResources,
    addResourceRecords,
    grantHeroXp,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: DungeonHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const statusSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const runSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, heroId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const

const ZERO_BAG: ResourceBag = { gold: 0, iron: 0, mana: 0, food: 0 }

export function buildDungeonHandler(deps: DungeonHandlerDependencies = createDefaultDependencies()) {
  return async function dungeonHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/dungeon', statusSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const day = dayBucket(deps.now())
        const run = await deps.findDungeonRun(user.id, day)
        return { day, ranToday: run !== null, lastWin: run?.win ?? null }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/dungeon/run', runSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, heroId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!heroId) return { error: 'No heroId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const hero = await deps.findHeroForUser(user.id, heroId)
        if (!hero) return { error: 'Hero not found' }

        const day = dayBucket(deps.now())
        const heroIdStr = String(hero._id)
        const seed = dungeonSeed(user.id, heroIdStr, day)
        // Fold equipped gear into the hero's stats — gear changes the OUTCOME of
        // the deterministic fight, never its seed (a retry still resolves identically).
        const gear = await deps.findEquippedForHero(heroIdStr)
        const bonus = aggregateEquipment(gear.map(g => ({ hp: g.bonusHp, atk: g.bonusAtk, def: g.bonusDef })))
        const combatant = withEquipment(statsForHero(hero.heroClass, hero.level), bonus)
        const result = resolveCombat(seed, combatant, dungeonEnemy(hero.level))
        const loot = result.win ? dungeonLoot(seed, hero.level) : ZERO_BAG
        const xpGained = result.win ? DUNGEON_XP_WIN : DUNGEON_XP_LOSS

        // Already run today → return the (deterministic) result for replay,
        // credit nothing. The claim collision below is the authoritative guard;
        // this pre-check just spares the write on the common repeat case.
        const existing = await deps.findDungeonRun(user.id, day)
        if (existing !== null) {
          return { win: result.win, rounds: result.rounds, loot, xpGained, alreadyRan: true }
        }

        // Claim the day. A second attempt collides → return the stored result,
        // credit nothing (deterministic seed means the fight was already fixed).
        const run = await deps.claimDungeonRun({ userId: user.id, day, heroId: heroIdStr, seed, win: result.win, loot, xpGained })
        if (run === null) {
          return { win: result.win, rounds: result.rounds, loot, xpGained, alreadyRan: true }
        }

        // Exactly-once credit (CAS). On a lost race, credit nothing.
        const won = await deps.claimDungeonCredit(run._id)
        if (won) {
          const castle = await deps.findOrCreateCastle(user)
          if (result.win) {
            await deps.creditResources(castle._id, loot)
            await deps.addResourceRecords(user.id, [
              { kind: ResourceKind.Gold, amount: loot.gold, type: ResourceChangeType.Loot },
              { kind: ResourceKind.Iron, amount: loot.iron, type: ResourceChangeType.Loot },
              { kind: ResourceKind.Mana, amount: loot.mana, type: ResourceChangeType.Loot },
              { kind: ResourceKind.Food, amount: loot.food, type: ResourceChangeType.Loot },
            ])
          }
          const xp = applyXp(hero.xp, hero.level, xpGained)
          await deps.grantHeroXp(heroIdStr, xp.xp, xp.level)
        }
        return { win: result.win, rounds: result.rounds, loot, xpGained, alreadyRan: false }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const dungeonHandler = buildDungeonHandler()

export default dungeonHandler
