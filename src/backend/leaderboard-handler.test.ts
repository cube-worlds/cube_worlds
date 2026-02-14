/* eslint-disable test/no-import-node-test */
import type { LeaderboardHandlerDependencies } from '#root/backend/leaderboard-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLeaderboardHandler } from '#root/backend/leaderboard-handler'
import fastify from 'fastify'

interface LeaderboardTestContext {
  app: ReturnType<typeof fastify>
  findWhalesCalls: Array<{ limit: number, skip: number }>
  stringifyCalls: number
}

async function createLeaderboardTestContext(
  overrides: Partial<LeaderboardHandlerDependencies> = {},
): Promise<LeaderboardTestContext> {
  const findWhalesCalls: Array<{ limit: number, skip: number }> = []
  let stringifyCalls = 0

  const dependencies: LeaderboardHandlerDependencies = {
    findWhales: ((limit: number, skip: number) => {
      findWhalesCalls.push({ limit, skip })
      return Promise.resolve([
        {
          wallet: 'EQ_TEST',
          votes: BigInt(42),
          minted: true,
        },
      ]) as unknown as ReturnType<LeaderboardHandlerDependencies['findWhales']>
    }) as LeaderboardHandlerDependencies['findWhales'],
    stringifyBigIntToJSON: ((value: unknown) => {
      stringifyCalls += 1
      return JSON.parse(
        JSON.stringify(value, (_key, item) =>
          (typeof item === 'bigint' ? item.toString() : item)),
      )
    }) as LeaderboardHandlerDependencies['stringifyBigIntToJSON'],
    ...overrides,
  }

  const app = fastify()
  await app.register(buildLeaderboardHandler(dependencies), {
    prefix: '/api/users',
  })

  return {
    app,
    findWhalesCalls,
    get stringifyCalls() {
      return stringifyCalls
    },
  }
}

test('GET /api/users/leaderboard uses default pagination values', async (t) => {
  const ctx = await createLeaderboardTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/users/leaderboard',
  })
  const body = response.json()

  assert.equal(response.statusCode, 200)
  assert.deepEqual(ctx.findWhalesCalls, [{ limit: 50, skip: 0 }])
  assert.equal(ctx.stringifyCalls, 1)
  assert.equal(body[0].wallet, 'EQ_TEST')
  assert.equal(body[0].votes, '42')
})

test('GET /api/users/leaderboard applies custom pagination values', async (t) => {
  const ctx = await createLeaderboardTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/users/leaderboard?limit=5&skip=12',
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(ctx.findWhalesCalls, [{ limit: 5, skip: 12 }])
})
