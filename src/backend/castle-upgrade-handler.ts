import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { Castle, UpgradeTrack } from '#root/common/models/Castle'
import { ClientError } from '#root/common/errors'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  findOrCreateCastle,
  MAX_TRACK_LEVEL,
  spendForUpgrade,
  UPGRADE_TRACKS,
  upgradeCost,
} from '#root/common/models/Castle'
import {
  addResourceRecords,
  ResourceChangeType,
  ResourceKind,
} from '#root/common/models/ResourceLedger'
import { addPoints, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, track: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface CastleUpgradeHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateCastle: (user: ExistingUser) => Promise<DocumentType<Castle>>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  spendForUpgrade: (
    castleId: unknown,
    cost: { gold: number, iron: number, mana: number, food: number },
    track: UpgradeTrack,
  ) => Promise<boolean>
  addResourceRecords: (
    userId: number,
    rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>,
  ) => Promise<void>
  logError: (message: string) => void
}

function createDefaultDependencies(): CastleUpgradeHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateCastle,
    addPoints,
    spendForUpgrade,
    addResourceRecords,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: CastleUpgradeHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

function isUpgradeTrack(value: string): value is UpgradeTrack {
  return (UPGRADE_TRACKS as readonly string[]).includes(value)
}

const bodySchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
        track: { type: 'string', maxLength: 16 },
      },
    },
  },
  attachValidation: true,
} as const

export function buildCastleUpgradeHandler(
  deps: CastleUpgradeHandlerDependencies = createDefaultDependencies(),
) {
  return async function castleUpgradeHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/castle/upgrade', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, track } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!track || !isUpgradeTrack(track)) return { error: 'Invalid upgrade track' }
      try {
        const user = await findUserByInitData(initData, deps)
        const castle = await deps.findOrCreateCastle(user)
        const currentLevel = castle[track]
        if (currentLevel >= MAX_TRACK_LEVEL) {
          return { error: 'Track is already at max level' }
        }
        const cost = upgradeCost(track, currentLevel)
        if (user.votes < cost.cube) {
          return { error: 'Not enough CUBE' }
        }
        await deps.addPoints(user.id, -cost.cube, BalanceChangeType.CastleUpgrade)
        const won = await deps.spendForUpgrade(castle._id, cost.resources, track)
        if (!won) {
          await deps.addPoints(user.id, cost.cube, BalanceChangeType.CastleUpgrade)
          return { error: 'Not enough resources' }
        }
        await deps.addResourceRecords(user.id, [
          { kind: ResourceKind.Gold, amount: -cost.resources.gold, type: ResourceChangeType.Upgrade },
          { kind: ResourceKind.Iron, amount: -cost.resources.iron, type: ResourceChangeType.Upgrade },
          { kind: ResourceKind.Mana, amount: -cost.resources.mana, type: ResourceChangeType.Upgrade },
          { kind: ResourceKind.Food, amount: -cost.resources.food, type: ResourceChangeType.Upgrade },
        ])
        return { track, newLevel: currentLevel + 1, cubeSpent: cost.cube.toString(), resourcesSpent: cost.resources }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const castleUpgradeHandler = buildCastleUpgradeHandler()

export default castleUpgradeHandler
