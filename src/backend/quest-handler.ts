import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { EquipmentDrop } from '#root/common/helpers/equipment'
import type { ResourceBag } from '#root/common/helpers/production'
import type { Castle } from '#root/common/models/Castle'
import type { Hero } from '#root/common/models/Hero'
import { ClientError } from '#root/common/errors'
import { applyXp } from '#root/common/helpers/hero'
import { isQuestReady, QUEST_DURATION_MS, questLoot, questSeed, questXp, rollQuestDrop } from '#root/common/helpers/quest'
import { creditResources, findOrCreateCastle } from '#root/common/models/Castle'
import { createEquipment } from '#root/common/models/Equipment'
import { findHeroForUser, grantHeroXp } from '#root/common/models/Hero'
import { claimQuest, findActiveQuestsForUser, findQuestById, startQuest } from '#root/common/models/HeroQuest'
import { addResourceRecords, ResourceChangeType, ResourceKind } from '#root/common/models/ResourceLedger'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, heroId?: string, questId?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type HeroDoc = Pick<DocumentType<Hero>, '_id' | 'level' | 'xp'>
interface QuestDoc { _id: unknown, heroId: string, endsAt: Date, seed: number, heroLevelAtStart: number, status: string }

export interface QuestHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findHeroForUser: (userId: number, heroId: string) => Promise<HeroDoc | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  now: () => Date
  findActiveQuestsForUser: (userId: number) => Promise<QuestDoc[]>
  findQuestById: (userId: number, questId: string) => Promise<QuestDoc | null>
  startQuest: (input: { userId: number, heroId: string, startedAt: Date, endsAt: Date, seed: number, heroLevelAtStart: number }) => Promise<{ _id: unknown, endsAt: Date } | null>
  claimQuest: (questId: unknown) => Promise<boolean>
  creditResources: (castleId: unknown, gain: ResourceBag) => Promise<void>
  addResourceRecords: (userId: number, rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>) => Promise<void>
  grantHeroXp: (heroId: string, xp: number, level: number) => Promise<void>
  createEquipment: (input: { userId: number, slot: EquipmentDrop['slot'], rarity: EquipmentDrop['rarity'], bonus: EquipmentDrop['bonus'], source: 'quest' }) => Promise<unknown>
  logError: (message: string) => void
}

function createDefaultDependencies(): QuestHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findHeroForUser: (userId, heroId) => findHeroForUser(userId, heroId) as never,
    findOrCreateCastle,
    now: () => new Date(),
    findActiveQuestsForUser: userId => findActiveQuestsForUser(userId) as never,
    findQuestById: (userId, questId) => findQuestById(userId, questId) as never,
    startQuest: input => startQuest(input) as never,
    claimQuest,
    creditResources,
    addResourceRecords,
    grantHeroXp,
    createEquipment: input => createEquipment(input) as never,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: QuestHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const statusSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const startSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, heroId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const
const claimSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, questId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const

export function buildQuestHandler(deps: QuestHandlerDependencies = createDefaultDependencies()) {
  return async function questHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/quest', statusSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const now = deps.now()
        const quests = await deps.findActiveQuestsForUser(user.id)
        return { quests: quests.map(q => ({ id: String(q._id), heroId: q.heroId, endsAt: q.endsAt, ready: isQuestReady(now, q.endsAt) })) }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/quest/start', startSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, heroId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!heroId) return { error: 'No heroId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const hero = await deps.findHeroForUser(user.id, heroId)
        if (!hero) return { error: 'Hero not found' }
        const now = deps.now()
        const heroIdStr = String(hero._id)
        const quest = await deps.startQuest({
          userId: user.id,
          heroId: heroIdStr,
          startedAt: now,
          endsAt: new Date(now.getTime() + QUEST_DURATION_MS),
          seed: questSeed(user.id, heroIdStr, now.getTime()),
          heroLevelAtStart: hero.level,
        })
        if (quest === null) return { error: 'Hero already on a quest' }
        return { quest: { id: String(quest._id), heroId: heroIdStr, endsAt: quest.endsAt } }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/quest/claim', claimSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, questId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!questId) return { error: 'No questId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const quest = await deps.findQuestById(user.id, questId)
        if (!quest) return { error: 'Quest not found' }
        const now = deps.now()
        if (!isQuestReady(now, quest.endsAt)) return { error: 'Quest not finished', endsAt: quest.endsAt }

        // Exactly-once credit behind the status CAS. A lost race credits nothing.
        const won = await deps.claimQuest(quest._id)
        if (!won) return { alreadyClaimed: true }

        const loot = questLoot(quest.seed, quest.heroLevelAtStart)
        const xpGained = questXp(quest.heroLevelAtStart)
        const drop = rollQuestDrop(quest.seed)

        const castle = await deps.findOrCreateCastle(user)
        await deps.creditResources(castle._id, loot)
        await deps.addResourceRecords(user.id, [
          { kind: ResourceKind.Gold, amount: loot.gold, type: ResourceChangeType.Loot },
          { kind: ResourceKind.Iron, amount: loot.iron, type: ResourceChangeType.Loot },
          { kind: ResourceKind.Mana, amount: loot.mana, type: ResourceChangeType.Loot },
          { kind: ResourceKind.Food, amount: loot.food, type: ResourceChangeType.Loot },
        ])

        let leveledUp = false
        const hero = await deps.findHeroForUser(user.id, quest.heroId)
        if (hero) {
          const xp = applyXp(hero.xp, hero.level, xpGained)
          leveledUp = xp.leveledUp
          await deps.grantHeroXp(quest.heroId, xp.xp, xp.level)
        }

        if (drop) {
          await deps.createEquipment({ userId: user.id, slot: drop.slot, rarity: drop.rarity, bonus: drop.bonus, source: 'quest' })
        }

        return { loot, xpGained, drop, leveledUp }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const questHandler = buildQuestHandler()

export default questHandler
