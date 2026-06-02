import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { ClientError } from '#root/common/errors'
import { REFILL_CUBE_COST, REFILL_ENERGY_AMOUNT } from '#root/common/helpers/energy'
import { BalanceChangeType } from '#root/common/models/Balance'
import { grantEnergy } from '#root/common/models/Energy'
import { addPoints, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface EnergyHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  grantEnergy: (user: ExistingUser, amount: number) => Promise<number>
  logError: (message: string) => void
}

function createDefaultDependencies(): EnergyHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    addPoints,
    grantEnergy: (user, amount) => grantEnergy(user, amount),
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: EnergyHandlerDependencies) {
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

export function buildEnergyHandler(
  deps: EnergyHandlerDependencies = createDefaultDependencies(),
) {
  return async function energyHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/energy/refill', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        if (user.votes < BigInt(REFILL_CUBE_COST)) {
          throw new ClientError('Not enough CUBE')
        }
        await deps.addPoints(user.id, -BigInt(REFILL_CUBE_COST), BalanceChangeType.Spend)
        const energy = await deps.grantEnergy(user, REFILL_ENERGY_AMOUNT)
        return {
          energy,
          spent: REFILL_CUBE_COST,
          message: `Refilled ${REFILL_ENERGY_AMOUNT} energy`,
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const energyHandler = buildEnergyHandler()

export default energyHandler
