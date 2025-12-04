import type { Bot } from '#root/bot/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger, loggerOptions } from '#root/logger'
import fastifyStatic from '@fastify/static'
import fastify from 'fastify'
import { webhookCallback } from 'grammy'
import authHandler from './backend/auth-handler'
import captchaHandler from './backend/captcha'
import nftHandler from './backend/nft-handler'
import { config } from './config'

export async function createServer(bot: Bot) {
    const server = fastify({
        logger: loggerOptions,
    })

    await server.register(authHandler, { prefix: '/api/auth' })
    await server.register(captchaHandler, { prefix: '/api/captcha', bot })
    await server.register(nftHandler, { prefix: '/api/nft' })

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    await server.register(fastifyStatic, {
        root: path.join(path.join(__dirname, 'frontend'), 'dist'),
        prefix: '/',
    })

    await server.register(fastifyStatic, {
        root: path.join(path.join(__dirname, 'frontend'), 'captcha'),
        prefix: '/captcha/',
        decorateReply: false,
    })

    server.setNotFoundHandler({ preHandler: [] }, (req, reply) => {
        if (req.raw.url && req.raw.url.startsWith('/api/')) {
            return reply.status(404).send({ error: 'API route not found' })
        }
        reply.type('text/html')
        reply.sendFile('index.html')
    })

    server.setErrorHandler(async (error, _request, response) => {
        logger.error(error)
        await response.status(500).send({ error: 'Oops! Something went wrong.' })
    })

    if (config.BOT_MODE === 'webhook') {
        server.post(
            `/${bot.token}`,
            webhookCallback(bot, 'fastify', {
                onTimeout: 'throw',
                timeoutMilliseconds: 10_000,
            }),
        )
    }

    logger.info(server.printRoutes())
    return server
}
