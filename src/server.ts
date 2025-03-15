import type { Bot } from '#root/bot/index.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger, loggerOptions } from '#root/logger.js'
import fastifyStatic from '@fastify/static'
import fastify from 'fastify'
import { webhookCallback } from 'grammy'
import analyticsHandler from './backend/analytics'
import { authHandler } from './backend/auth-handler'
import checkCaptcha from './backend/captcha'
import nftHandler from './backend/nft-handler'
import tappadsHandler from './backend/tappads'
import { config } from './config'

export async function createServer(bot: Bot) {
  const server = fastify({
    logger: loggerOptions,
  })

  server.setErrorHandler(async (error, _request, response) => {
    logger.error(error)

    await response.status(500).send({ error: 'Oops! Something went wrong.' })
  })

  await server.register(authHandler, { prefix: '/api/auth' })

  await server.register(analyticsHandler, { prefix: '/api/analytics' })

  await server.register(nftHandler, { prefix: '/api/nft' })

  await server.register(tappadsHandler, { prefix: '/api/tappads' })

  await server.register(checkCaptcha, { bot })

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

  server.setNotFoundHandler(async (_request, reply) => {
    await reply.sendFile('index.html')
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

  return server
}
