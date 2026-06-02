import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { findUserById } from '#root/common/models/User'
import { ClientError } from '#root/common/errors'
import { safeErrorResponse } from './safe-error'

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface SeasonPassInvoiceHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  createStarsInvoiceLink: (input: { userId: number }) => Promise<string>
  logError: (message: string) => void
}

async function findUserByInitData(initData: string, deps: SeasonPassInvoiceHandlerDependencies) {
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

const bodySchema = {
  schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } },
  attachValidation: true,
} as const

export function buildSeasonPassInvoiceHandler(deps: SeasonPassInvoiceHandlerDependencies) {
  return async function seasonPassInvoiceHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: { initData: string } }>('/season-pass/invoice', bodySchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const link = await deps.createStarsInvoiceLink({ userId: user.id })
        return { link }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}
