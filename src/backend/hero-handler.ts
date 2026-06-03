import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { HeroClass } from '#root/common/helpers/hero'
import type { Castle } from '#root/common/models/Castle'
import type { Hero } from '#root/common/models/Hero'
import { ClientError } from '#root/common/errors'
import { isFounder } from '#root/common/helpers/founder'
import { HERO_CLASSES, recruitCost, tavernCapacity } from '#root/common/helpers/hero'
import { BalanceChangeType } from '#root/common/models/Balance'
import { findOrCreateCastle, spendResources } from '#root/common/models/Castle'
import { countHeroesByUser, createHero, findHeroesByUser, isFirstHero } from '#root/common/models/Hero'
import { addResourceRecords, ResourceChangeType, ResourceKind } from '#root/common/models/ResourceLedger'
import { addPoints, debitVotes, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, heroClass?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface HeroHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  countHeroesByUser: (userId: number) => Promise<number>
  findHeroesByUser: (userId: number) => Promise<Array<DocumentType<Hero>>>
  debitVotes: (userId: number, amount: bigint, reason: BalanceChangeType) => Promise<bigint | null>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  spendResources: (castleId: unknown, cost: { gold: number, iron: number, mana: number, food: number }) => Promise<boolean>
  addResourceRecords: (userId: number, rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>) => Promise<void>
  createHero: (input: { userId: number, heroClass: HeroClass, soulbound: boolean, founderVariant: boolean }) => Promise<DocumentType<Hero>>
  logError: (message: string) => void
}

function createDefaultDependencies(): HeroHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateCastle,
    countHeroesByUser,
    findHeroesByUser: userId => findHeroesByUser(userId) as never,
    debitVotes,
    addPoints,
    spendResources,
    addResourceRecords,
    createHero,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: HeroHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

function isHeroClass(value: string): value is HeroClass {
  return (HERO_CLASSES as readonly string[]).includes(value)
}

const listSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const recruitSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, heroClass: { type: 'string', maxLength: 16 } } } }, attachValidation: true } as const

function heroView(h: DocumentType<Hero>) {
  return { id: String(h._id), heroClass: h.heroClass, level: h.level, xp: h.xp, soulbound: h.soulbound, founderVariant: h.founderVariant, nftMinted: h.nftMinted }
}

export function buildHeroHandler(deps: HeroHandlerDependencies = createDefaultDependencies()) {
  return async function heroHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/heroes', listSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const heroes = await deps.findHeroesByUser(user.id)
        return { heroes: heroes.map(heroView) }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/recruit', recruitSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, heroClass } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!heroClass || !isHeroClass(heroClass)) return { error: 'Invalid hero class' }
      try {
        const user = await findUserByInitData(initData, deps)
        const castle = await deps.findOrCreateCastle(user)
        const count = await deps.countHeroesByUser(user.id)
        if (count >= tavernCapacity(castle.tavern)) return { error: 'Tavern at capacity' }

        const cost = recruitCost(count)
        // CUBE sink first (atomic, overdraft-safe).
        const newBalance = await deps.debitVotes(user.id, cost.cube, BalanceChangeType.Recruit)
        if (newBalance === null) return { error: 'Not enough CUBE' }
        // Gold sink (atomic). Refund the CUBE if it loses.
        const goldCost = { gold: cost.gold, iron: 0, mana: 0, food: 0 }
        const won = await deps.spendResources(castle._id, goldCost)
        if (!won) {
          await deps.addPoints(user.id, cost.cube, BalanceChangeType.Recruit)
          return { error: 'Not enough Gold' }
        }
        await deps.addResourceRecords(user.id, [{ kind: ResourceKind.Gold, amount: -cost.gold, type: ResourceChangeType.Recruit }])

        const hero = await deps.createHero({
          userId: user.id,
          heroClass,
          soulbound: isFirstHero(count),
          founderVariant: isFounder(user),
        })
        return { hero: heroView(hero), cubeSpent: cost.cube.toString(), goldSpent: cost.gold }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const heroHandler = buildHeroHandler()

export default heroHandler
