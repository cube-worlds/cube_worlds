import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { parse, validate } from '@telegram-apps/init-data-node'

interface Body {
    initData: string
    referId?: string
}

async function authHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/login', async (request) => {
        const { initData, referId } = request.body
        if (!initData)
            return { error: `No initData or hash provided` }

        try {
            const expiresIn = 60 * 60 * 24 * 7 // 7 days
            validate(initData, config.BOT_TOKEN, { expiresIn })
            const parsedData: InitData = parse(initData)

            const tgUserId = parsedData?.user?.id
            if (!tgUserId) {
                return { error: 'Invalid telegram user id' }
            }
            const user = await findUserById(tgUserId)
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
