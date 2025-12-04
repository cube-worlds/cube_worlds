import type { FastifyInstance } from 'fastify'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { validate } from '@telegram-apps/init-data-node'

interface Parameters {
    userId: string
}

interface Body {
    initData: string
    referId?: string
}

async function authHandler(fastify: FastifyInstance) {
    fastify.post<{ Params: Parameters, Body: Body }>('/:userId', async (request) => {
        const { userId } = request.params
        if (!userId)
            return { error: 'No userId provided' }

        const { initData, referId } = request.body
        if (!initData)
            return { error: `No initData or hash provided` }

        try {
            validate(initData, config.BOT_TOKEN, { expiresIn: 86400 })
            const user = await findUserById(Number(userId))
            if (!user)
                return { error: 'User not found' }

            const userAlreadyInvited = user.wallet || user.referalId
            if (referId && !userAlreadyInvited) {
                const receiverId = Number(referId)
                const receiver = await findUserById(receiverId)
                if (receiver && receiverId !== user.id) {
                    user.referalId = receiverId
                    await user.save()
                    logger.info('Referrer added successfully')
                } else {
                    logger.error('Referrer not found or same as user')
                }
            }
            return {
                id: user.id,
                language: user.language,
                wallet: user.wallet,
                referalId: user.referalId,
                balance: user.votes.toString(),
                ip: request.ip,
            }
        } catch (error) {
            return { error: (error as Error).message ?? 'Unknown error' }
        }
    })
}

export default authHandler
