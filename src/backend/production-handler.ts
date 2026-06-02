import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Castle } from '#root/common/models/Castle'
import { ClientError } from '#root/common/errors'
import { isFounder } from '#root/common/helpers/founder'
import { computeProduction, PRODUCTION_TICK_MS } from '#root/common/helpers/production'
import {
  creditProduction,
  findOrCreateCastle,
  readBag,
} from '#root/common/models/Castle'
import {
  addResourceRecords,
  ResourceChangeType,
  ResourceKind,
} from '#root/common/models/ResourceLedger'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface ProductionHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  now: () => Date
  creditProduction: (castleId: unknown, gained: ReturnType<typeof readBag>, next: Date) => Promise<void>
  addResourceRecords: (
    userId: number,
    rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>,
  ) => Promise<void>
  logError: (message: string) => void
}

function createDefaultDependencies(): ProductionHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateCastle,
    now: () => new Date(),
    creditProduction,
    addResourceRecords,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: ProductionHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const bodySchema = {
  schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } },
  attachValidation: true,
} as const

function statusPayload(
  castle: DocumentType<Castle>,
  user: ExistingUser,
  now: Date,
) {
  const founder = isFounder(user)
  const { gained, nextProductionAt } = computeProduction(
    { lastProductionAt: castle.lastProductionAt, mineLevel: castle.mine, isFounder: founder },
    now,
  )
  const msToNext = Math.max(
    0,
    castle.lastProductionAt.getTime() + PRODUCTION_TICK_MS - now.getTime(),
  )
  return {
    isFounder: founder,
    resources: readBag(castle),
    tracks: { walls: castle.walls, forge: castle.forge, tavern: castle.tavern, mine: castle.mine },
    claimable: gained,
    nextProductionAt,
    secondsUntilTick: Math.ceil(msToNext / 1000),
  }
}

export function buildProductionHandler(
  deps: ProductionHandlerDependencies = createDefaultDependencies(),
) {
  return async function productionHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/castle', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const castle = await deps.findOrCreateCastle(user)
        return statusPayload(castle, user, deps.now())
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/castle/claim', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const castle = await deps.findOrCreateCastle(user)
        const now = deps.now()
        const founder = isFounder(user)
        const { ticks, gained, nextProductionAt } = computeProduction(
          { lastProductionAt: castle.lastProductionAt, mineLevel: castle.mine, isFounder: founder },
          now,
        )
        if (ticks > 0) {
          await deps.creditProduction(castle._id, gained, nextProductionAt)
          await deps.addResourceRecords(user.id, [
            { kind: ResourceKind.Gold, amount: gained.gold, type: ResourceChangeType.Production },
            { kind: ResourceKind.Iron, amount: gained.iron, type: ResourceChangeType.Production },
            { kind: ResourceKind.Mana, amount: gained.mana, type: ResourceChangeType.Production },
            { kind: ResourceKind.Food, amount: gained.food, type: ResourceChangeType.Production },
          ])
        }
        return { claimed: gained, ticks, nextProductionAt }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const productionHandler = buildProductionHandler()

export default productionHandler
