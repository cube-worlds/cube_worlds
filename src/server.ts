import type { Bot } from '#root/bot/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger, loggerOptions } from '#root/logger'
import middie from '@fastify/middie'
import fastifyStatic from '@fastify/static'
import fastify from 'fastify'
import { webhookCallback } from 'grammy'
import { createServer as createViteServer } from 'vite'
import authHandler from './backend/auth-handler'
import balancesHandler from './backend/balances-handler'
import captchaHandler from './backend/captcha'
import leaderboardHandler from './backend/leaderboard-handler'
import nftHandler from './backend/nft-handler'
import setWalletHandler from './backend/set-wallet-handler'
import { config } from './config'

export async function createServer(bot: Bot) {
  const server = fastify({ logger: loggerOptions })

  // Enable Express-style middleware in Fastify
  await server.register(middie)

  await server.register(authHandler, { prefix: '/api/auth' })
  await server.register(setWalletHandler, { prefix: '/api/auth' })

  await server.register(captchaHandler, { prefix: '/api/captcha', bot })
  await server.register(nftHandler, { prefix: '/api/nft' })

  await server.register(balancesHandler, { prefix: '/api/users' })
  await server.register(leaderboardHandler, { prefix: '/api/users' })

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const frontendPath = path.join(__dirname, 'frontend')

  if (config.NODE_ENV === 'development') {
    // run front with HMR
    const vite = await createViteServer({
      root: frontendPath,
      server: { middlewareMode: true },
    })

    // Attach Vite as middleware
    server.use(vite.middlewares)

    server.setNotFoundHandler(async (req, reply) => {
      if (req.raw.url?.startsWith('/api/')) {
        return reply.status(404).send({ error: 'API route not found' })
      }
      const url = req.raw.url || '/'
      const html = await vite.transformIndexHtml(
        url,
        '<!DOCTYPE html><html><head></head><body></body></html>',
      )
      return reply.type('text/html').send(html)
    })
  } else {
    await server.register(fastifyStatic, {
      root: path.join(frontendPath, 'dist'),
      prefix: '/',
    })
    server.setNotFoundHandler({ preHandler: [] }, (req, reply) => {
      if (req.raw.url?.startsWith('/api/')) {
        return reply.status(404).send({ error: 'API route not found' })
      }
      reply.type('text/html').sendFile('index.html')
    })
  }

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
