import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { XRocketClient } from '#root/common/helpers/xrocket'
import type { findUserById } from '#root/common/models/User'
import type { WalletEntryStatus } from '#root/common/models/WalletLedger'
import { ClientError } from '#root/common/errors'
import { ENERGY_PACK_AMOUNT, ENERGY_PACK_PRICE_USDT } from '#root/common/helpers/energy'
import {
  microToUsdt,
  usdtToMicro,
  validateUsdtAmount,
  WALLET_CURRENCY,
  WalletEntryType,
} from '#root/common/helpers/wallet'
import { safeErrorResponse } from './safe-error'

// `findUserById` is imported only for its return type — the handler is pure and
// receives the live implementation (and initData validators) via `deps`. The
// composer (`wallet.ts`) wires the real `defaultParseInitData`/`defaultValidateInitData`.
type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface WalletHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  getBalance: (userId: number) => Promise<bigint>
  applyDebit: (userId: number, amount: bigint) => Promise<bigint>
  creditBalance: (userId: number, amount: bigint) => Promise<bigint>
  grantEnergy: (user: ExistingUser, amount: number) => Promise<number>
  insertLedgerEntry: (entry: {
    userId: number
    type: WalletEntryType
    amount: bigint
    externalId: string
    status?: WalletEntryStatus
    meta?: Record<string, unknown>
  }) => Promise<{ _id: unknown }>
  setLedgerStatus: (externalId: string, status: WalletEntryStatus) => Promise<void>
  areWithdrawalsPaused: () => Promise<boolean>
  generateId: () => string
  callbackUrl: () => string
  xrocket: XRocketClient
  logError: (message: string) => void
}

async function findUserByInitData(initData: string, deps: WalletHandlerDependencies) {
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

const initDataSchema = {
  schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } },
  attachValidation: true,
} as const

const amountSchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
        amount: { type: 'number' },
      },
    },
  },
  attachValidation: true,
} as const

const transferSchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
        tgUserId: { type: 'integer', minimum: 1 },
        amount: { type: 'number' },
      },
    },
  },
  attachValidation: true,
} as const

const withdrawSchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        initData: { type: 'string', maxLength: 8192 },
        network: { type: 'string', enum: ['TON', 'BSC', 'ETH', 'BTC', 'TRX', 'SOL'] },
        address: { type: 'string', maxLength: 256 },
        amount: { type: 'number' },
      },
    },
  },
  attachValidation: true,
} as const

export function buildWalletHandler(deps: WalletHandlerDependencies) {
  return async function walletHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: { initData: string } }>('/balance', initDataSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const balance = await deps.getBalance(user.id)
        return { balance: microToUsdt(balance), currency: WALLET_CURRENCY }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: { initData: string, amount: number } }>('/invoice', amountSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData, amount } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        validateUsdtAmount(amount) // reject bad amounts before hitting xRocket
        const invoice = await deps.xrocket.createInvoice({
          amount,
          currency: WALLET_CURRENCY,
          payload: `u:${user.id}`,
          callbackUrl: deps.callbackUrl(),
          expiredIn: 3600,
        })
        return { link: invoice.link, invoiceId: invoice.id }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: { initData: string } }>('/buy-energy', initDataSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const cost = validateUsdtAmount(ENERGY_PACK_PRICE_USDT)
        // Atomic debit first — throws ClientError if unaffordable, so no energy
        // is granted on insufficient funds.
        await deps.applyDebit(user.id, cost)
        await deps.insertLedgerEntry({
          userId: user.id,
          type: WalletEntryType.BuyEnergy,
          amount: -cost, // debit
          externalId: deps.generateId(),
          meta: { energy: ENERGY_PACK_AMOUNT },
        })
        const energy = await deps.grantEnergy(user, ENERGY_PACK_AMOUNT)
        return { energy, spentUsdt: ENERGY_PACK_PRICE_USDT }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: { initData: string, tgUserId: number, amount: number } }>('/transfer', transferSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData, tgUserId, amount } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        if (await deps.areWithdrawalsPaused()) {
          throw new ClientError('Withdrawals are temporarily paused')
        }
        const user = await findUserByInitData(initData, deps)
        const micro = validateUsdtAmount(amount)
        await deps.applyDebit(user.id, micro)
        const transferId = deps.generateId()
        await deps.insertLedgerEntry({
          userId: user.id,
          type: WalletEntryType.Transfer,
          amount: -micro,
          externalId: transferId,
          meta: { tgUserId },
        })
        try {
          await deps.xrocket.transfer({
            tgUserId,
            currency: WALLET_CURRENCY,
            amount,
            transferId,
            description: 'Cube Worlds transfer',
          })
        }
        catch (err) {
          await deps.creditBalance(user.id, micro) // refund
          await deps.setLedgerStatus(transferId, 'failed' as never)
          deps.logError(`transfer failed for ${user.id}: ${(err as Error).message}`)
          throw new ClientError('Transfer failed, balance refunded')
        }
        await deps.setLedgerStatus(transferId, 'completed' as never)
        return { ok: true }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: { initData: string, network: string, address: string, amount: number } }>('/withdraw', withdrawSchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData, network, address, amount } = request.body
      if (!initData || !network || !address)
        return { error: 'Invalid request body' }
      try {
        if (await deps.areWithdrawalsPaused()) {
          throw new ClientError('Withdrawals are temporarily paused')
        }
        const user = await findUserByInitData(initData, deps)
        validateUsdtAmount(amount)

        const feeTable = await deps.xrocket.getWithdrawalFees(WALLET_CURRENCY)
        const usdt = feeTable.find(f => f.code === WALLET_CURRENCY)
        if (!usdt || amount < usdt.minWithdraw) {
          throw new ClientError('Below minimum withdrawal')
        }
        const networkFee = usdt.fees.find(f => f.networkCode === network)
        if (!networkFee)
          throw new ClientError('Unsupported network')
        const feeUsdt = networkFee.feeWithdraw.fee

        // User pays amount + network fee; debit both atomically.
        const totalMicro = usdtToMicro(amount) + usdtToMicro(feeUsdt)
        await deps.applyDebit(user.id, totalMicro)
        const withdrawalId = deps.generateId()
        await deps.insertLedgerEntry({
          userId: user.id,
          type: WalletEntryType.Withdraw,
          amount: -totalMicro,
          externalId: withdrawalId,
          meta: { network, address, amount, feeUsdt },
        })
        try {
          const result = await deps.xrocket.withdrawal({
            network,
            address,
            currency: WALLET_CURRENCY,
            amount,
            withdrawalId,
          })
          await deps.setLedgerStatus(withdrawalId, 'completed' as never)
          return { status: result.status, feeUsdt }
        }
        catch (err) {
          await deps.creditBalance(user.id, totalMicro) // refund
          await deps.setLedgerStatus(withdrawalId, 'failed' as never)
          deps.logError(`withdrawal failed for ${user.id}: ${(err as Error).message}`)
          throw new ClientError('Withdrawal failed, balance refunded')
        }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}
