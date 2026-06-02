import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Risk } from '#root/common/helpers/congestion'
import type { Energy } from '#root/common/models/Energy'
import { ClientError } from '#root/common/errors'
import { EXPEDITION_ENERGY_COST } from '#root/common/helpers/energy'
import { currentTickId } from '#root/common/helpers/tick'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  findOrCreateEnergy,
  spendEnergy,
} from '#root/common/models/Energy'
import {
  BOOST_CUBE_PER_WEIGHT,
  commitmentWeight,
  createExpedition,
} from '#root/common/models/Expedition'
import { addPoints, findUserById } from '#root/common/models/User'
import { addWorldCommitment, ensureWorldsForTick, WorldModel } from '#root/common/models/World'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
  worldId: string
  risk: Risk
  cubeBoost?: number
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface ExpeditionHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  currentTickId: () => number
  ensureWorldsForTick: (tickId: number) => Promise<void>
  findWorld: (tickId: number, worldId: string) => Promise<{ worldId: string } | null>
  findOrCreateEnergy: (user: ExistingUser) => Promise<DocumentType<Energy>>
  spendEnergy: (energy: DocumentType<Energy>, amount: number) => Promise<{ current: number }>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  createExpedition: (input: {
    userId: number
    tickId: number
    worldId: string
    energySpent: number
    cubeBoost: number
    weight: number
    risk: Risk
  }) => Promise<{ _id: unknown }>
  addWorldCommitment: (tickId: number, worldId: string, weight: number) => Promise<void>
  logError: (message: string) => void
}

function createDefaultDependencies(): ExpeditionHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    currentTickId: () => currentTickId(),
    ensureWorldsForTick,
    findWorld: (tickId, worldId) =>
      WorldModel.findOne({ tickId, worldId }) as never,
    findOrCreateEnergy,
    spendEnergy: (energy, amount) => spendEnergy(energy, amount),
    addPoints,
    createExpedition: (input) => createExpedition(input) as never,
    addWorldCommitment,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: ExpeditionHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const bodySchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
        worldId: { type: 'string', maxLength: 64 },
        risk: { type: 'string', enum: ['safe', 'greedy'] },
        cubeBoost: { type: 'integer', minimum: 0, maximum: 1_000_000_000 },
      },
    },
  },
  attachValidation: true,
} as const

export function buildExpeditionHandler(
  deps: ExpeditionHandlerDependencies = createDefaultDependencies(),
) {
  return async function expeditionHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/expedition', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, worldId, risk, cubeBoost = 0 } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!worldId || (risk !== 'safe' && risk !== 'greedy')) {
        return { error: 'Invalid request body' }
      }
      try {
        const user = await findUserByInitData(initData, deps)
        const tickId = deps.currentTickId()
        await deps.ensureWorldsForTick(tickId)

        const world = await deps.findWorld(tickId, worldId)
        if (!world) throw new ClientError('Unknown world')

        if (cubeBoost > 0 && user.votes < BigInt(cubeBoost)) {
          throw new ClientError('Not enough CUBE')
        }

        const energyDoc = await deps.findOrCreateEnergy(user)
        // Spend energy first (atomic CAS). If this throws, nothing else ran.
        await deps.spendEnergy(energyDoc, EXPEDITION_ENERGY_COST)

        // Debit the optional CUBE boost (sink).
        if (cubeBoost > 0) {
          await deps.addPoints(user.id, -BigInt(cubeBoost), BalanceChangeType.Spend)
        }

        const weight = commitmentWeight(EXPEDITION_ENERGY_COST, cubeBoost)
        try {
          await deps.createExpedition({
            userId: user.id,
            tickId,
            worldId,
            energySpent: EXPEDITION_ENERGY_COST,
            cubeBoost,
            weight,
            risk,
          })
        } catch (err) {
          if ((err as { code?: number }).code === 11000) {
            throw new ClientError('Already sent an expedition this tick')
          }
          throw err
        }

        await deps.addWorldCommitment(tickId, worldId, weight)

        return {
          worldId,
          risk,
          weight,
          tickId,
          cubeBoostPerWeight: BOOST_CUBE_PER_WEIGHT,
          message: `Expedition sent to ${worldId}`,
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const expeditionHandler = buildExpeditionHandler()

export default expeditionHandler
