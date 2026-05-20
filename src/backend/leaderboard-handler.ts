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
    fastify.get<{ Querystring: { limit?: number, skip?: number } }>(
      '/leaderboard',
      {
        schema: {
          querystring: {
            type: 'object',
            properties: {
              limit: { type: 'integer', default: 50 },
              skip: { type: 'integer', default: 0 },
            },
          },
        },
        // Preserve the existing { error } shape for non-integer input.
        // The handler still clamps the integer to [1, 100] / [0, ∞) so a
        // client overshooting the bound gets results, not a 4xx.
        attachValidation: true,
      },
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid pagination parameters' }
        }
        const limit = Math.min(Math.max(1, request.query.limit ?? 50), 100)
        const skip = Math.max(0, request.query.skip ?? 0)
        const balances = await dependencies.findWhales(limit, skip)
        return dependencies.stringifyBigIntToJSON(balances)
      },
    )
  }
}

const leaderboardHandler = buildLeaderboardHandler()

export default leaderboardHandler
