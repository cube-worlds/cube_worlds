import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { ClientError } from '#root/common/errors'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  claimDaily,
  findOrCreateClaim,
  getClaimStatus,
} from '#root/common/models/Claim'
import { addPoints, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type ClaimRecord = Awaited<ReturnType<typeof findOrCreateClaim>>

export interface ClaimHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findOrCreateClaim: (user: ExistingUser) => Promise<ClaimRecord>
  getClaimStatus: (claim: ClaimRecord) => ReturnType<typeof getClaimStatus>
  claimDaily: (claim: ClaimRecord) => ReturnType<typeof claimDaily>
  addPoints: (
    userId: number,
    add: bigint,
    reason: BalanceChangeType,
  ) => Promise<bigint>
  logError: (message: string) => void
}

function createDefaultDependencies(): ClaimHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateClaim,
    getClaimStatus,
    claimDaily,
    addPoints,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(
  initData: string,
  dependencies: ClaimHandlerDependencies,
) {
  dependencies.validateInitData(initData)
  const parsedData = dependencies.parseInitData(initData)
  const tgUserId = parsedData?.user?.id
  if (!tgUserId) {
    throw new ClientError('Invalid telegram user id')
  }

  const user = await dependencies.findUserById(tgUserId)
  if (!user) {
    throw new ClientError('User not found in database')
  }
  return user
}

const claimBodySchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
      },
    },
  },
  // Keep legacy { error } envelope: missing initData stays a
  // handler-level check; only ill-typed/oversized bodies hit AJV.
  attachValidation: true,
} as const

export function buildClaimHandler(
  dependencies: ClaimHandlerDependencies = createDefaultDependencies(),
) {
  return async function claimHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/claim/status',
      claimBodySchema,
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData } = request.body
        if (!initData) return { error: 'No initData provided' }

        try {
          const user = await findUserByInitData(initData, dependencies)
          const claim = await dependencies.findOrCreateClaim(user)
          const status = dependencies.getClaimStatus(claim)

          return {
            id: user.id,
            ...status,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    fastify.post<{ Body: Body }>(
      '/claim',
      claimBodySchema,
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData } = request.body
        if (!initData) return { error: 'No initData provided' }

        try {
          const user = await findUserByInitData(initData, dependencies)
          const claim = await dependencies.findOrCreateClaim(user)
          const { claimedAmount, rawClaimAmount } = await dependencies.claimDaily(
            claim,
          )

          let balance = user.votes
          if (claimedAmount > 0) {
            balance = await dependencies.addPoints(
              user.id,
              BigInt(claimedAmount),
              BalanceChangeType.Claim,
            )
          }
          const status = dependencies.getClaimStatus(claim)

          return {
            id: user.id,
            message: `Claimed ${claimedAmount} $CUBE successfully`,
            claimedAmount,
            rawClaimAmount,
            balance: balance.toString(),
            ...status,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}

const claimHandler = buildClaimHandler()

export default claimHandler
