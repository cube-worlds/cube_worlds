import type { FastifyInstance } from 'fastify'
import { stringifyBigIntToJSON } from '#root/common/helpers/json'
import { findWhales } from '#root/common/models/User'

export interface LeaderboardHandlerDependencies {
  findWhales: (limit: number, skip: number) => ReturnType<typeof findWhales>
  stringifyBigIntToJSON: (
    value: Awaited<ReturnType<typeof findWhales>>,
  ) => ReturnType<typeof stringifyBigIntToJSON>
}

function createDefaultDependencies(): LeaderboardHandlerDependencies {
  return {
    findWhales,
    stringifyBigIntToJSON,
  }
}

export function buildLeaderboardHandler(
  dependencies: LeaderboardHandlerDependencies = createDefaultDependencies(),
) {
  return async function leaderboardHandler(fastify: FastifyInstance) {
    fastify.get<{
      Querystring: {
        limit?: number | string
        skip?: number | string
      }
    }>('/leaderboard', async (request) => {
      const limit = Math.min(Math.max(1, Number(request.query.limit ?? 50)), 100)
      const skip = Math.max(0, Number(request.query.skip ?? 0))
      if (Number.isNaN(limit) || Number.isNaN(skip)) {
        return { error: 'Invalid pagination parameters' }
      }
      const balances = await dependencies.findWhales(limit, skip)
      return dependencies.stringifyBigIntToJSON(balances)
    })
  }
}

const leaderboardHandler = buildLeaderboardHandler()

export default leaderboardHandler
