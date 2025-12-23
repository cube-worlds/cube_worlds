import type { FastifyInstance } from 'fastify'
import { countAllBalances, countAllWallets } from '#root/common/models/User'

async function balancesHandler(fastify: FastifyInstance) {
  fastify.get('/balances', async (_request: { query: any }, _reply: any) => {
    const wallets = await countAllWallets()
    const balances = await countAllBalances()
    return {
      wallets,
      balances,
    }
  })
}

export default balancesHandler
