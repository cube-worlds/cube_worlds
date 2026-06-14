import type { Bot } from '#root/bot/index'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import middie from '@fastify/middie'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import fastify from 'fastify'
import { webhookCallback } from 'grammy'
import { logger, loggerOptions } from '#root/logger'
import adRewardHandler from './backend/ad-reward'
import authHandler from './backend/auth-handler'
import balancesHandler from './backend/balances-handler'
import bossHandler from './backend/boss-handler'
import castleUpgradeHandler from './backend/castle-upgrade-handler'
import claimHandler from './backend/claim-handler'
import dungeonHandler from './backend/dungeon-handler'
import energyHandler from './backend/energy-handler'
import equipmentHandler from './backend/equipment-handler'
import expeditionHandler from './backend/expedition-handler'
import heroHandler from './backend/hero-handler'
import leaderboardHandler from './backend/leaderboard-handler'
import mintHandler from './backend/mint'
import nftHandler from './backend/nft-handler'
import productionHandler from './backend/production-handler'
import pvpHandler from './backend/pvp-handler'
import questHandler from './backend/quest-handler'
import { createSeasonPassInvoiceHandler } from './backend/season-pass-invoice'
import setWalletHandler from './backend/set-wallet-handler'
import tournamentHandler from './backend/tournament'
import walletHandler from './backend/wallet'
import walletNonceHandler from './backend/wallet-nonce-handler'
import walletWebhookHandler from './backend/wallet-webhook'
import worldsHandler from './backend/worlds-handler'
import { config } from './config'

const ROUTE_RATE_LIMITS: Record<string, { max: number, timeWindow: string }> = {
  '/api/auth/login': { max: 30, timeWindow: '1 minute' },
  '/api/auth/set-wallet': { max: 20, timeWindow: '1 minute' },
  '/api/auth/wallet-nonce': { max: 20, timeWindow: '1 minute' },
  '/api/users/claim': { max: 12, timeWindow: '1 minute' },
  '/api/users/claim/status': { max: 30, timeWindow: '1 minute' },
  '/api/users/leaderboard': { max: 60, timeWindow: '1 minute' },
  '/api/users/balances': { max: 60, timeWindow: '1 minute' },
  '/api/game/worlds': { max: 60, timeWindow: '1 minute' },
  '/api/game/expedition': { max: 30, timeWindow: '1 minute' },
  '/api/game/energy/refill': { max: 20, timeWindow: '1 minute' },
  '/api/game/tournament': { max: 60, timeWindow: '1 minute' },
  '/api/game/tournament/enter': { max: 15, timeWindow: '1 minute' },
  '/api/game/ad-nonce': { max: 20, timeWindow: '1 minute' },
  '/api/game/ad-reward': { max: 60, timeWindow: '1 minute' }, // S2S; the nonce is the real gate
  '/api/game/season-pass/invoice': { max: 15, timeWindow: '1 minute' },
  '/api/wallet/webhook': { max: 120, timeWindow: '1 minute' },
  '/api/wallet/balance': { max: 60, timeWindow: '1 minute' },
  '/api/wallet/invoice': { max: 20, timeWindow: '1 minute' },
  '/api/wallet/buy-energy': { max: 30, timeWindow: '1 minute' },
  '/api/wallet/withdraw': { max: 10, timeWindow: '1 minute' },
  '/api/wallet/transfer': { max: 15, timeWindow: '1 minute' },
}

export async function createServer(bot: Bot) {
  // Bounded `trustProxy` — defaults to 1 hop in prod, 0 in dev. With
  // `trustProxy: true` a client reaching the Node port directly could spoof
  // X-Forwarded-For and defeat the per-IP rate limit; the bounded form only
  // honors the N rightmost entries (i.e. the actual reverse proxies).
  const server = fastify({
    logger: loggerOptions,
    trustProxy: config.TRUSTED_PROXY_HOPS,
  })

  // Enable Express-style middleware in Fastify
  await server.register(middie)

  // Security headers. CSP and frameguard are disabled so the Telegram WebView
  // (and Telegram Web's iframe-based Mini App host) can load the frontend.
  // Other defaults (X-Content-Type-Options, Strict-Transport-Security,
  // Referrer-Policy, etc.) remain active.
  await server.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
  })

  // CORS: in development reflect any origin so Vite/ngrok work out of the box.
  // In production allow only WEB_APP_URL plus any ALLOWED_ORIGINS overrides.
  const productionOrigins = new Set<string>([
    new URL(config.WEB_APP_URL).origin,
    ...config.ALLOWED_ORIGINS,
  ])
  await server.register(cors, {
    origin: config.isDev
      ? true
      : (origin, cb) => {
          if (!origin || productionOrigins.has(origin)) {
            cb(null, true)
            return
          }
          cb(new Error('Not allowed by CORS'), false)
        },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  // Per-route rate limit overrides. Hook must be registered before
  // @fastify/rate-limit so this onRoute fires first and sets `config.rateLimit`
  // before the rate-limit plugin reads it.
  server.addHook('onRoute', (routeOptions) => {
    const override = ROUTE_RATE_LIMITS[routeOptions.url]
    if (override) {
      routeOptions.config = {
        ...(routeOptions.config ?? {}),
        rateLimit: override,
      }
    }
  })

  await server.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    allowList: (request) => !request.url.startsWith('/api/'),
  })

  await server.register(authHandler, { prefix: '/api/auth' })
  await server.register(mintHandler, { prefix: '/api/mint' })
  await server.register(setWalletHandler, { prefix: '/api/auth' })
  await server.register(walletNonceHandler, { prefix: '/api/auth' })

  await server.register(nftHandler, { prefix: '/api/nft' })

  await server.register(balancesHandler, { prefix: '/api/users' })
  await server.register(leaderboardHandler, { prefix: '/api/users' })
  await server.register(claimHandler, { prefix: '/api/users' })

  await server.register(worldsHandler, { prefix: '/api/game' })
  await server.register(productionHandler, { prefix: '/api/game' })
  await server.register(castleUpgradeHandler, { prefix: '/api/game' })
  await server.register(heroHandler, { prefix: '/api/game' })
  await server.register(dungeonHandler, { prefix: '/api/game' })
  await server.register(equipmentHandler, { prefix: '/api/game' })
  await server.register(questHandler, { prefix: '/api/game' })
  await server.register(bossHandler, { prefix: '/api/game' })
  await server.register(expeditionHandler, { prefix: '/api/game' })
  await server.register(energyHandler, { prefix: '/api/game' })
  await server.register(pvpHandler, { prefix: '/api/game' })
  await server.register(tournamentHandler, { prefix: '/api/game' })
  await server.register(adRewardHandler, { prefix: '/api/game' })
  await server.register(createSeasonPassInvoiceHandler(bot.api), { prefix: '/api/game' })

  await server.register(walletWebhookHandler, { prefix: '/api/wallet' })
  await server.register(walletHandler, { prefix: '/api/wallet' })

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const frontendPath = path.join(__dirname, 'frontend')

  if (config.NODE_ENV === 'development') {
    // Load vite from the frontend's own node_modules: the frontend's
    // vite.config.ts and plugins resolve there, and two copies of vite's
    // native rolldown binding in one process segfault on dlopen.
    const { createServer: createViteServer } = (await import(
      pathToFileURL(
        path.join(frontendPath, 'node_modules/vite/dist/node/index.js'),
      ).href
    )) as typeof import('vite')

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
      const indexHtml = await fs.readFile(
        path.join(frontendPath, 'index.html'),
        'utf-8',
      )
      const html = await vite.transformIndexHtml(url, indexHtml)
      reply.type('text/html').send(html)
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
      '/telegram/webhook',
      webhookCallback(bot, 'fastify', {
        onTimeout: 'throw',
        timeoutMilliseconds: 10_000,
        secretToken: config.BOT_WEBHOOK_SECRET,
      }),
    )
  }

  logger.info(server.printRoutes())
  return server
}
