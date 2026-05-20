import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import process from 'node:process'
import { parse, validate } from '@telegram-apps/init-data-node'
import { Address } from '@ton/core'
import { findUserById, findUserByWallet } from '#root/common/models/User'

interface Body {
  initData: string
  wallet: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type ParsedAddress = ReturnType<typeof Address.parse>

export interface SetWalletHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findUserByWallet: (wallet: string) => Promise<ExistingUser | null>
  parseWalletAddress: (wallet: string) => ParsedAddress
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
    parseWalletAddress: Address.parse,
  }
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
              wallet: { type: 'string', maxLength: 128 },
            },
          },
        },
        // Keep legacy { error } envelope: per-field missing checks stay
        // handler-level; only ill-typed/oversized bodies hit AJV.
        attachValidation: true,
      },
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData, wallet } = request.body

        if (!initData) return { error: 'No initData provided' }
        if (!wallet) return { error: 'No wallet provided' }

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

          let address: ParsedAddress
          try {
            address = dependencies.parseWalletAddress(wallet)
          } catch {
            return { error: 'Invalid wallet address' }
          }

          const bounceable = address.toString({ bounceable: true })
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
          return { error: (err as Error).message }
        }
      },
    )
  }
}

const setWalletHandler = buildSetWalletHandler()

export default setWalletHandler
