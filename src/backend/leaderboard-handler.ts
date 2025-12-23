import type { FastifyInstance } from 'fastify'
import { stringifyBigIntToJSON } from '#root/common/helpers/json'
import { findWhales } from '#root/common/models/User'

async function leaderboardHandler(fastify: FastifyInstance) {
  fastify.get('/leaderboard', async (request: { query: any }, _reply: any) => {
    const limit = Number(request.query.limit ?? 50)
    const skip = Number(request.query.skip ?? 0)
    const balances = await findWhales(limit, skip)
    return stringifyBigIntToJSON(balances)
  })
}

export default leaderboardHandler
