import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Hero } from '#root/common/models/Hero'
import { ClientError } from '#root/common/errors'
import { BOSS_ATTACK_XP, bossDamage, bossForWeek } from '#root/common/helpers/boss'
import { hashSeed, resolveCombat } from '#root/common/helpers/combat'
import { dayBucket } from '#root/common/helpers/dungeon'
import { aggregateEquipment, withEquipment } from '#root/common/helpers/equipment'
import { applyXp, statsForHero } from '#root/common/helpers/hero'
import { currentWeekId } from '#root/common/helpers/tournament'
import { aggregateDamageByUser, findUserBossDamage, hasAttackedToday, recordBossAttack } from '#root/common/models/BossAttack'
import { findEquippedForHero } from '#root/common/models/Equipment'
import { findHeroForUser, grantHeroXp } from '#root/common/models/Hero'
import { findActiveQuestForHero } from '#root/common/models/HeroQuest'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, heroId?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type HeroDoc = Pick<DocumentType<Hero>, '_id' | 'heroClass' | 'level' | 'xp'>

export interface BossHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findHeroForUser: (userId: number, heroId: string) => Promise<HeroDoc | null>
  findEquippedForHero: (heroId: string) => Promise<Array<{ bonusHp: number, bonusAtk: number, bonusDef: number }>>
  findActiveQuestForHero: (heroId: string) => Promise<{ _id: unknown } | null>
  now: () => Date
  hasAttackedToday: (userId: number, weekId: number, day: number) => Promise<{ _id: unknown } | null>
  findUserBossDamage: (userId: number, weekId: number) => Promise<number>
  aggregateDamageByUser: (weekId: number) => Promise<Array<{ userId: number, total: number }>>
  recordBossAttack: (input: { userId: number, weekId: number, day: number, heroId: string, seed: number, damage: number }) => Promise<{ _id: unknown } | null>
  grantHeroXp: (heroId: string, xp: number, level: number) => Promise<void>
  logError: (message: string) => void
}

function createDefaultDependencies(): BossHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findHeroForUser: (userId, heroId) => findHeroForUser(userId, heroId) as never,
    findEquippedForHero: heroId => findEquippedForHero(heroId) as never,
    findActiveQuestForHero: heroId => findActiveQuestForHero(heroId) as never,
    now: () => new Date(),
    hasAttackedToday: (userId, weekId, day) => hasAttackedToday(userId, weekId, day) as never,
    findUserBossDamage,
    aggregateDamageByUser,
    recordBossAttack: input => recordBossAttack(input) as never,
    grantHeroXp,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: BossHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const statusSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const attackSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, heroId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const

export function buildBossHandler(deps: BossHandlerDependencies = createDefaultDependencies()) {
  return async function bossHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/boss', statusSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const now = deps.now()
        const week = currentWeekId(now)
        const day = dayBucket(now)
        const [yourDamage, board, today] = await Promise.all([
          deps.findUserBossDamage(user.id, week),
          deps.aggregateDamageByUser(week),
          deps.hasAttackedToday(user.id, week, day),
        ])
        const rankIndex = board.findIndex(b => b.userId === user.id)
        return {
          week,
          boss: bossForWeek(week),
          yourDamage,
          yourRank: rankIndex >= 0 ? rankIndex + 1 : null,
          contributors: board.length,
          attackedToday: today !== null,
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/boss/attack', attackSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, heroId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!heroId) return { error: 'No heroId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const hero = await deps.findHeroForUser(user.id, heroId)
        if (!hero) return { error: 'Hero not found' }
        const heroIdStr = String(hero._id)
        const onQuest = await deps.findActiveQuestForHero(heroIdStr)
        if (onQuest) return { error: 'Hero is away on a quest' }

        const now = deps.now()
        const week = currentWeekId(now)
        const day = dayBucket(now)
        const seed = hashSeed(`${user.id}:${heroIdStr}:${week}:${day}`)
        const boss = bossForWeek(week)
        const gear = await deps.findEquippedForHero(heroIdStr)
        const bonus = aggregateEquipment(gear.map(g => ({ hp: g.bonusHp, atk: g.bonusAtk, def: g.bonusDef })))
        const combatant = withEquipment(statsForHero(hero.heroClass, hero.level), bonus)
        const result = resolveCombat(seed, combatant, boss)
        const damage = bossDamage(seed, combatant, boss)

        const rec = await deps.recordBossAttack({ userId: user.id, weekId: week, day, heroId: heroIdStr, seed, damage })
        if (rec === null) return { error: 'Already attacked the boss today' }

        const xp = applyXp(hero.xp, hero.level, BOSS_ATTACK_XP)
        await deps.grantHeroXp(heroIdStr, xp.xp, xp.level)

        return { damage, rounds: result.rounds, xpGained: BOSS_ATTACK_XP, leveledUp: xp.leveledUp }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const bossHandler = buildBossHandler()

export default bossHandler
