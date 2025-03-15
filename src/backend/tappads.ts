import { usdToPoints } from '#root/bot/helpers/points'
import { BalanceChangeType } from '#root/bot/models/balance'
import { addPoints, findUserById } from '#root/bot/models/user'
import { config } from '#root/config'
import { logger } from '#root/logger'

function tappadsHandler(fastify: any, _options: any, done: () => void) {
  const secretUrl = config.TAPPADS_SECRET_URL

  fastify.get(secretUrl, async (request: any, _reply: any) => {
    const { offer, payout, currency, goal_id, clickid, sub3 } = request.query
    if (sub3) {
      const userId = Number(sub3)
      const user = await findUserById(userId)
      if (!user) {
        logger.error(`User ${userId} not found`)
        return { result: false }
      }
      logger.info(`User ${userId} solved ${offer}:${clickid}:${goal_id} with ${payout}${currency}`)
      const points = usdToPoints(payout)
      await addPoints(userId, points, BalanceChangeType.Task)
      return { result: true }
    }
    return { result: false }
  })
  done()
}

export default tappadsHandler
