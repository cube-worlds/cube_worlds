import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { parse, validate } from '@telegram-apps/init-data-node'
import { Address } from '@ton/core'

interface Body {
  initData: string
  wallet: string
}

async function setWalletHandler(fastify: FastifyInstance) {
  fastify.post<{ Body: Body }>('/set-wallet', async (request) => {
    const { initData, wallet } = request.body

    if (!initData) return { error: 'No initData provided' }

    if (!wallet) return { error: 'No wallet provided' }

    try {
      const expiresIn = 60 * 60 * 24 * 7
      validate(initData, config.BOT_TOKEN, { expiresIn })
      const parsedData: InitData = parse(initData)

      const tgUserId = parsedData?.user?.id
      if (!tgUserId) {
        return { error: 'Invalid telegram user id' }
      }

      const user = await findUserById(tgUserId)
      if (!user) {
        return { error: 'User not found in database' }
      }

      let address
      try {
        address = Address.parse(wallet)
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

export default setWalletHandler
