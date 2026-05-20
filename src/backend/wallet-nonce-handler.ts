import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import process from 'node:process'
import { parse, validate } from '@telegram-apps/init-data-node'
import { logger } from '#root/logger'
import { safeErrorResponse } from './safe-error'
import { issueNonce } from './ton-proof'

interface Body {
  initData: string
}

export interface WalletNonceHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  issueNonce: (userId: number) => { payload: string, validUntil: number }
  logError: (message: string) => void
}

function createDefaultDependencies(): WalletNonceHandlerDependencies {
  return {
    validateInitData: (initData: string) => {
      const botToken = process.env.BOT_TOKEN
      if (!botToken) {
        throw new Error('BOT_TOKEN is not configured')
      }
      const expiresIn = 60 * 60 * 24
      validate(initData, botToken, { expiresIn })
    },
    parseInitData: parse,
    issueNonce: (userId) => issueNonce(userId),
    logError: logger.error.bind(logger),
  }
}

export function buildWalletNonceHandler(
  dependencies: WalletNonceHandlerDependencies = createDefaultDependencies(),
) {
  return async function walletNonceHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/wallet-nonce',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              initData: { type: 'string', maxLength: 8192 },
            },
          },
        },
        attachValidation: true,
      },
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData } = request.body
        if (!initData) return { error: 'No initData provided' }

        try {
          dependencies.validateInitData(initData)
          const parsedData = dependencies.parseInitData(initData)
          const tgUserId = parsedData?.user?.id
          if (!tgUserId) {
            return { error: 'Invalid telegram user id' }
          }
          const nonce = dependencies.issueNonce(tgUserId)
          return { payload: nonce.payload, validUntil: nonce.validUntil }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}

const walletNonceHandler = buildWalletNonceHandler()

export default walletNonceHandler
