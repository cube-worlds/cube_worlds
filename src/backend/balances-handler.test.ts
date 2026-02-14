/* eslint-disable test/no-import-node-test */
import type { BalancesHandlerDependencies } from '#root/backend/balances-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBalancesHandler } from '#root/backend/balances-handler'
import fastify from 'fastify'

interface BalancesTestContext {
  app: ReturnType<typeof fastify>
  countAllWalletsCalls: number
  countAllBalancesCalls: number
}

async function createBalancesTestContext(
  overrides: Partial<BalancesHandlerDependencies> = {},
): Promise<BalancesTestContext> {
  let countAllWalletsCalls = 0
  let countAllBalancesCalls = 0

  const dependencies: BalancesHandlerDependencies = {
    countAllWallets: async () => {
      countAllWalletsCalls += 1
      return 33
    },
    countAllBalances: async () => {
      countAllBalancesCalls += 1
      return 4444
    },
    ...overrides,
  }

  const app = fastify()
  await app.register(buildBalancesHandler(dependencies), { prefix: '/api/users' })

  return {
    app,
    get countAllWalletsCalls() {
      return countAllWalletsCalls
    },
    get countAllBalancesCalls() {
      return countAllBalancesCalls
    },
  }
}

test('GET /api/users/balances returns aggregated values', async (t) => {
  const ctx = await createBalancesTestContext()
  t.after(async () => {
    await ctx.app.close()
  })

  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/users/balances',
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    wallets: 33,
    balances: 4444,
  })
  assert.equal(ctx.countAllWalletsCalls, 1)
  assert.equal(ctx.countAllBalancesCalls, 1)
})
