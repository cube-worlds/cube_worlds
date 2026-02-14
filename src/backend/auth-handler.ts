import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import process from 'node:process'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { parse, validate } from '@telegram-apps/init-data-node'

interface Body {
  initData: string
  referId?: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface AuthHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  info: (message: string) => void
  error: (message: string) => void
}

function createDefaultDependencies(): AuthHandlerDependencies {
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
    info: logger.info.bind(logger),
    error: logger.error.bind(logger),
  }
}

export function buildAuthHandler(
  dependencies: AuthHandlerDependencies = createDefaultDependencies(),
) {
  return async function authHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/login', async (request) => {
      const { initData, referId } = request.body
      if (!initData) return { error: 'No initData or hash provided' }

      try {
        dependencies.validateInitData(initData)
        const parsedData = dependencies.parseInitData(initData)

        const tgUserId = parsedData?.user?.id
        if (!tgUserId) {
          return { error: 'Invalid telegram user id' }
        }
        const user = await dependencies.findUserById(tgUserId)
        if (!user) return { error: 'User not found' }

        const userAlreadyInvited = user.wallet || user.referalId
        if (referId && !userAlreadyInvited) {
          const receiverId = Number(referId)
          const receiver = await dependencies.findUserById(receiverId)
          if (receiver && receiverId !== user.id) {
            user.referalId = receiverId
            await user.save()
            dependencies.info('Referrer added successfully')
          } else {
            dependencies.error('Referrer not found or same as user')
          }
        }

        return {
          id: user.id,
          language: user.language,
          wallet: user.wallet,
          referalId: user.referalId,
          balance: user.votes.toString(),
          ip: request.ip,
        }
      } catch (error) {
        return { error: (error as Error).message ?? 'Unknown error' }
      }
    })
  }
}

const authHandler = buildAuthHandler()

export default authHandler
