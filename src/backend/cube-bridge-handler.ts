import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { ClientError } from '#root/common/errors'
import { applyWithdrawFee, canWithdraw } from '#root/common/helpers/cube-bridge'
import { randomId } from '#root/common/helpers/random'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  CubeBridgeEntryType,
  CubeBridgeStatus,
  insertBridgeRow,
  lastWithdrawAt,
  markBridgeStatus,
} from '#root/common/models/CubeBridgeLedger'
import { addPoints, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

const MIN_WITHDRAW = 100n

interface Body { initData: string, amount?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface CubeBridgeHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  vaultAddress: () => string
  lastWithdrawAt: (userId: number) => Promise<Date | null>
  now: () => Date
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  insertBridgeRow: (row: {
    userId: number, type: CubeBridgeEntryType, amount: bigint, fee: bigint, externalId: string, status?: CubeBridgeStatus
  }) => Promise<boolean>
  randomExternalId: () => string
  sendCubeJetton: (toWallet: string, net: bigint) => Promise<string>
  markBridgeStatus: (externalId: string, status: CubeBridgeStatus) => Promise<void>
  logError: (message: string) => void
}

export function createDefaultDependencies(): CubeBridgeHandlerDependencies {
  // vaultAddress/sendCubeJetton are config+chain bound — the composer overrides
  // them. The pure fields have real defaults; the chain fields throw if used unwired.
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    vaultAddress: () => { throw new Error('vaultAddress not wired') },
    lastWithdrawAt,
    now: () => new Date(),
    addPoints,
    insertBridgeRow,
    randomExternalId: () => `wd-${randomId()}`,
    sendCubeJetton: () => { throw new Error('sendCubeJetton not wired') },
    markBridgeStatus,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: CubeBridgeHandlerDependencies) {
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
        amount: { type: 'string', maxLength: 32 },
      },
    },
  },
  attachValidation: true,
} as const

export function buildCubeBridgeHandler(
  deps: CubeBridgeHandlerDependencies = createDefaultDependencies(),
) {
  return async function cubeBridgeHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/status', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const last = await deps.lastWithdrawAt(user.id)
        const check = canWithdraw(last, deps.now())
        return {
          balance: user.votes.toString(),
          wallet: user.wallet ?? null,
          depositAddress: deps.vaultAddress(),
          canWithdraw: check.ok,
          cooldownSecondsRemaining: Math.ceil(check.msRemaining / 1000),
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/withdraw', bodySchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, amount } = request.body
      if (!initData) return { error: 'No initData provided' }
      let gross: bigint
      try {
        gross = BigInt(amount ?? '0')
      } catch {
        return { error: 'Invalid amount' }
      }
      if (gross < MIN_WITHDRAW) return { error: 'Amount below minimum' }
      try {
        const user = await findUserByInitData(initData, deps)
        if (!user.wallet) return { error: 'No wallet bound' }
        if (user.votes < gross) return { error: 'Not enough CUBE' }
        const last = await deps.lastWithdrawAt(user.id)
        if (!canWithdraw(last, deps.now()).ok) return { error: 'Withdraw cooldown active' }

        const { fee, net } = applyWithdrawFee(gross)
        const externalId = deps.randomExternalId()
        await deps.addPoints(user.id, -gross, BalanceChangeType.Withdraw)
        await deps.insertBridgeRow({
          userId: user.id, type: CubeBridgeEntryType.Withdraw, amount: gross, fee, externalId, status: CubeBridgeStatus.Pending,
        })
        try {
          await deps.sendCubeJetton(user.wallet, net)
          await deps.markBridgeStatus(externalId, CubeBridgeStatus.Completed)
          return { ok: true, gross: gross.toString(), fee: fee.toString(), net: net.toString() }
        } catch (sendErr) {
          await deps.addPoints(user.id, gross, BalanceChangeType.Withdraw)
          await deps.markBridgeStatus(externalId, CubeBridgeStatus.Failed)
          deps.logError(`CUBE withdraw failed for ${user.id}: ${(sendErr as Error).message}`)
          return { error: 'Withdraw failed, CUBE refunded' }
        }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const cubeBridgeHandler = buildCubeBridgeHandler()

export default cubeBridgeHandler
