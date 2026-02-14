import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import process from 'node:process'
import { findUserById } from '#root/common/models/User'
import { parse, validate } from '@telegram-apps/init-data-node'
import { Address } from '@ton/core'

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
  parseWalletAddress: (wallet: string) => ParsedAddress
}

function createDefaultDependencies(): SetWalletHandlerDependencies {
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
    parseWalletAddress: Address.parse,
  }
}

export function buildSetWalletHandler(
  dependencies: SetWalletHandlerDependencies = createDefaultDependencies(),
) {
  return async function setWalletHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/set-wallet', async (request) => {
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

        user.wallet = address.toString({ bounceable: true })
        await user.save()

        return {
          id: user.id,
          wallet: user.wallet,
          message: 'Wallet updated successfully',
        }
      } catch (err) {
        return { error: (err as Error).message }
      }
    })
  }
}

const setWalletHandler = buildSetWalletHandler()

export default setWalletHandler
