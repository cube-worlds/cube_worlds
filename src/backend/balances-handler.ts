import type { FastifyInstance } from 'fastify'
import { countAllBalances, countAllWallets } from '#root/common/models/User'

export interface BalancesHandlerDependencies {
  countAllWallets: () => Promise<number>
  countAllBalances: () => Promise<number>
}

function createDefaultDependencies(): BalancesHandlerDependencies {
  return {
    countAllWallets,
    countAllBalances,
  }
}

export function buildBalancesHandler(
  dependencies: BalancesHandlerDependencies = createDefaultDependencies(),
) {
  return async function balancesHandler(fastify: FastifyInstance) {
    fastify.get('/balances', async () => {
      const wallets = await dependencies.countAllWallets()
      const balances = await dependencies.countAllBalances()
      return {
        wallets,
        balances,
      }
    })
  }
}

const balancesHandler = buildBalancesHandler()

export default balancesHandler
