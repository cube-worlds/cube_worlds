import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import process from 'node:process'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  claimDaily,
  findOrCreateClaim,
  getClaimStatus,
} from '#root/common/models/Claim'
import { addPoints, findUserById } from '#root/common/models/User'
import { parse, validate } from '@telegram-apps/init-data-node'

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
}

function createDefaultDependencies(): ClaimHandlerDependencies {
  return {
    validateInitData: (initData: string) => {
      const botToken = process.env.BOT_TOKEN
      if (!botToken) {
        throw new Error('BOT_TOKEN is not configured')
      }
      const expiresIn = 60 * 60 * 24 * 7
      validate(initData, botToken, { expiresIn })
    },
    parseInitData: parse,
    findUserById,
    findOrCreateClaim,
    getClaimStatus,
    claimDaily,
    addPoints,
  }
}

const claimLocks = new Map<number, Promise<unknown>>()

async function withUserClaimLock<T>(
  userId: number,
  action: () => Promise<T>,
): Promise<T> {
  const currentLock = claimLocks.get(userId) ?? Promise.resolve()
  const nextLock = currentLock.catch(() => undefined).then(action)

  claimLocks.set(userId, nextLock)
  try {
    return await nextLock
  } finally {
    if (claimLocks.get(userId) === nextLock) {
      claimLocks.delete(userId)
    }
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
    throw new Error('Invalid telegram user id')
  }

  const user = await dependencies.findUserById(tgUserId)
  if (!user) {
    throw new Error('User not found in database')
  }
  return user
}

export function buildClaimHandler(
  dependencies: ClaimHandlerDependencies = createDefaultDependencies(),
) {
  return async function claimHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/claim/status', async (request) => {
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
        return { error: (err as Error).message }
      }
    })

    fastify.post<{ Body: Body }>('/claim', async (request) => {
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }

      try {
        const user = await findUserByInitData(initData, dependencies)
        return await withUserClaimLock(user.id, async () => {
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
        })
      } catch (err) {
        return { error: (err as Error).message }
      }
    })
  }
}

const claimHandler = buildClaimHandler()

export default claimHandler
