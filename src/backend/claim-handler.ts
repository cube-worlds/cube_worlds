import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { parse, validate } from '@telegram-apps/init-data-node'

interface Body {
  initData: string
}

async function claimHandler(fastify: FastifyInstance) {
  fastify.post<{ Body: Body }>('/claim', async (request) => {
    const { initData } = request.body

    if (!initData) return { error: 'No initData provided' }

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

      // TODO: think about additional validation logic

      // TODO: add claim logic
      const value = 1
      //   await user.save()

      return {
        id: user.id,
        message: `Claimed ${value} $CUBE successfully`,
      }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })
}

export default claimHandler
