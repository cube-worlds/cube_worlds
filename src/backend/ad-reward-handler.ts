import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { findUserById } from '#root/common/models/User'
import { ClientError } from '#root/common/errors'
import { AD_DAILY_CAP, AD_ENERGY_REWARD } from '#root/common/helpers/energy'
import { RewardsEntryType } from '#root/common/models/RewardsPoolLedger'
import { safeErrorResponse } from './safe-error'

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface AdRewardHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  adBlockId: () => string
  issueAdNonce: (userId: number) => { payload: string, validUntil: number }
  verifyAdNonce: (payload: string, now: number) => { userId: number, rand: string } | null
  utcDay: (now?: Date) => string
  countAdGrantsToday: (userId: number, day: string) => Promise<number>
  recordAdGrant: (g: { userId: number, nonceRand: string, day: string, energy: number }) => Promise<void>
  grantEnergy: (user: ExistingUser, amount: number) => Promise<number>
  accrueRewards: (entry: { type: RewardsEntryType, amount: bigint, externalId: string, meta?: Record<string, unknown> }) => Promise<void>
  adRevenueMicro: () => bigint
  accrueShare: (amountMicro: bigint) => bigint
  now: () => number
  logError: (message: string) => void
}

async function findUserByInitData(initData: string, deps: AdRewardHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId)
    throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user)
    throw new ClientError('User not found in database')
  return user
}

const nonceSchema = {
  schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } },
  attachValidation: true,
} as const

const rewardSchema = {
  schema: { querystring: { type: 'object', properties: { payload: { type: 'string', maxLength: 512 } } } },
} as const

export function buildAdRewardHandler(deps: AdRewardHandlerDependencies) {
  return async function adRewardHandler(fastify: FastifyInstance) {
    // Authenticated: issue a single-use nonce the frontend hands to Adsgram.
    fastify.post<{ Body: { initData: string } }>('/ad-nonce', nonceSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const nonce = deps.issueAdNonce(user.id)
        return { payload: nonce.payload, blockId: deps.adBlockId(), validUntil: nonce.validUntil }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    // Server-to-server reward callback from Adsgram. Unauthenticated — the nonce
    // is the integrity boundary (single-use, short-TTL, HMAC-bound to userId).
    fastify.get<{ Querystring: { payload?: string } }>('/ad-reward', rewardSchema, async (request, reply) => {
      const payload = request.query.payload
      const verified = payload ? deps.verifyAdNonce(payload, deps.now()) : null
      if (!verified) {
        return reply.status(403).send({ ok: false })
      }
      try {
        const day = deps.utcDay(new Date(deps.now()))
        const count = await deps.countAdGrantsToday(verified.userId, day)
        if (count >= AD_DAILY_CAP) {
          // 200 so Adsgram doesn't keep retrying — the user simply hit the cap.
          return { ok: false, reason: 'cap' }
        }
        // Single-use: a replayed nonce collides on the unique index → no second
        // grant, but report success so Adsgram treats it as delivered.
        try {
          await deps.recordAdGrant({ userId: verified.userId, nonceRand: verified.rand, day, energy: AD_ENERGY_REWARD })
        }
        catch (err) {
          if ((err as { code?: number }).code === 11000) {
            return { ok: true }
          }
          throw err
        }
        const user = await deps.findUserById(verified.userId)
        if (user) {
          await deps.grantEnergy(user, AD_ENERGY_REWARD)
        }
        // Best-effort 20% accrual of the estimated ad revenue.
        try {
          await deps.accrueRewards({
            type: RewardsEntryType.AccrualAd,
            amount: deps.accrueShare(deps.adRevenueMicro()),
            externalId: `accrual:ad:${verified.rand}`,
          })
        }
        catch (err) {
          deps.logError(`rewards accrual failed for ad grant ${verified.rand}: ${(err as Error).message}`)
        }
        return { ok: true }
      }
      catch (err) {
        deps.logError(`ad-reward failed: ${(err as Error).message}`)
        return reply.status(500).send({ ok: false })
      }
    })
  }
}
