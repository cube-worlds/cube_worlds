import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Energy } from '#root/common/models/Energy'
import { ClientError } from '#root/common/errors'
import { currentTickId } from '#root/common/helpers/tick'
import {
  findOrCreateEnergy,
  getEnergyStatus,
} from '#root/common/models/Energy'
import { findMyExpeditionForTick } from '#root/common/models/Expedition'
import { findUserById } from '#root/common/models/User'
import { ensureWorldsForTick, findWorldsForTick } from '#root/common/models/World'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface WorldsHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateEnergy: (user: ExistingUser) => Promise<DocumentType<Energy>>
  getEnergyStatus: (energy: DocumentType<Energy>) => ReturnType<typeof getEnergyStatus>
  currentTickId: () => number
  ensureWorldsForTick: (tickId: number) => Promise<void>
  findWorldsForTick: (tickId: number) => Promise<Array<{
    worldId: string
    name: string
    cubePool: number
    totalWeight: number
    explorerCount: number
  }>>
  findMyExpeditionForTick: (
    userId: number,
    tickId: number,
  ) => Promise<{ worldId: string, risk: string, weight: number } | null>
  logError: (message: string) => void
}

function createDefaultDependencies(): WorldsHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateEnergy,
    getEnergyStatus,
    currentTickId: () => currentTickId(),
    ensureWorldsForTick,
    findWorldsForTick: (tickId) => findWorldsForTick(tickId) as never,
    findMyExpeditionForTick: (userId, tickId) =>
      findMyExpeditionForTick(userId, tickId) as never,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(
  initData: string,
  deps: WorldsHandlerDependencies,
) {
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

export function buildWorldsHandler(
  deps: WorldsHandlerDependencies = createDefaultDependencies(),
) {
  return async function worldsHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/worlds', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const tickId = deps.currentTickId()
        await deps.ensureWorldsForTick(tickId)
        const energyDoc = await deps.findOrCreateEnergy(user)
        const energy = deps.getEnergyStatus(energyDoc)
        const worlds = await deps.findWorldsForTick(tickId)
        const mine = await deps.findMyExpeditionForTick(user.id, tickId)
        return {
          tickId,
          energy: { current: energy.current, max: energy.max },
          worlds: worlds.map((w) => ({
            worldId: w.worldId,
            name: w.name,
            cubePool: w.cubePool,
            explorerCount: w.explorerCount,
            totalWeight: w.totalWeight,
          })),
          myExpedition: mine
            ? { worldId: mine.worldId, risk: mine.risk, weight: mine.weight }
            : null,
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const worldsHandler = buildWorldsHandler()

export default worldsHandler
