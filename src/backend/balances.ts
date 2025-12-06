import type { FastifyInstance } from 'fastify'
import { countAllBalances } from '#root/common/models/User'

async function balancesHandler(fastify: FastifyInstance) {
    fastify.get('/balances', async (_request: { query: any }, _reply: any) => {
        const balances = await countAllBalances()
        return {
            sum: balances,
        }
    })
}

export default balancesHandler
