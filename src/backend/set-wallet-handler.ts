import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { VerifyProofInput, VerifyResult } from './ton-proof'
import process from 'node:process'
import { parse, validate } from '@telegram-apps/init-data-node'
import { findUserById, findUserByWallet } from '#root/common/models/User'
import { logger } from '#root/logger'
import { safeErrorResponse } from './safe-error'
import { verifyProof as verifyProofImpl } from './ton-proof'

interface ProofBody {
  timestamp: number
  domain: { lengthBytes: number, value: string }
  payload: string
  signature: string
}

interface Body {
  initData: string
  address: string
  publicKey: string
  walletStateInit: string
  proof: ProofBody
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

export interface SetWalletHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findUserByWallet: (wallet: string) => Promise<ExistingUser | null>
  verifyProof: (input: VerifyProofInput) => VerifyResult
  getExpectedDomain: () => string
  logError: (message: string) => void
}

function createDefaultDependencies(): SetWalletHandlerDependencies {
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
    findUserById,
    findUserByWallet,
    verifyProof: verifyProofImpl,
    getExpectedDomain: () => {
      const url = process.env.WEB_APP_URL
      if (!url) {
        throw new Error('WEB_APP_URL is not configured')
      }
      return new URL(url).host
    },
    logError: logger.error.bind(logger),
  }
}

const PROOF_BODY_SCHEMA = {
  type: 'object',
  required: ['timestamp', 'domain', 'payload', 'signature'],
  properties: {
    timestamp: { type: 'integer', minimum: 0 },
    domain: {
      type: 'object',
      required: ['lengthBytes', 'value'],
      properties: {
        lengthBytes: { type: 'integer', minimum: 0, maximum: 4096 },
        value: { type: 'string', maxLength: 4096 },
      },
    },
    payload: { type: 'string', maxLength: 512 },
    signature: { type: 'string', maxLength: 512 },
  },
}

export function buildSetWalletHandler(
  dependencies: SetWalletHandlerDependencies = createDefaultDependencies(),
) {
  return async function setWalletHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/set-wallet',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              initData: { type: 'string', maxLength: 8192 },
              address: { type: 'string', maxLength: 128 },
              publicKey: { type: 'string', maxLength: 128 },
              walletStateInit: { type: 'string', maxLength: 16_384 },
              proof: PROOF_BODY_SCHEMA,
            },
          },
        },
        // Keep the legacy `{ error }` envelope: per-field missing checks stay
        // in the handler; only ill-typed/oversized bodies hit AJV.
        attachValidation: true,
      },
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData, address, publicKey, walletStateInit, proof } = request.body

        if (!initData) return { error: 'No initData provided' }
        if (!address) return { error: 'No wallet provided' }
        if (!publicKey || !walletStateInit || !proof) {
          return { error: 'Wallet proof required' }
        }

        try {
          dependencies.validateInitData(initData)
          const parsedData = dependencies.parseInitData(initData)

          const tgUserId = parsedData?.user?.id
          if (!tgUserId) {
            return { error: 'Invalid telegram user id' }
          }

          const user = await dependencies.findUserById(tgUserId)
          if (!user) {
            return { error: 'User not found in database' }
          }

          const verification = dependencies.verifyProof({
            proof,
            publicKey,
            walletStateInit,
            address,
            expectedDomain: dependencies.getExpectedDomain(),
            userId: tgUserId,
          })
          if (!verification.ok) {
            return { error: 'Wallet proof invalid' }
          }

          const bounceable = verification.boundAddress
          const existingOwner = await dependencies.findUserByWallet(bounceable)
          if (existingOwner && existingOwner.id !== user.id) {
            return { error: 'Wallet already linked to another account' }
          }

          user.wallet = bounceable
          await user.save()

          return {
            id: user.id,
            wallet: user.wallet,
            message: 'Wallet updated successfully',
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}

const setWalletHandler = buildSetWalletHandler()

export default setWalletHandler
