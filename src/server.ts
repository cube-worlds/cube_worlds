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
import authHandler from './backend/auth-handler'
import { createAvatarHandler } from './backend/avatar'
import balancesHandler from './backend/balances-handler'
import claimHandler from './backend/claim-handler'
import leaderboardHandler from './backend/leaderboard-handler'
import { createMintHandler } from './backend/mint'
import nftHandler from './backend/nft-handler'
import { createPassHandler } from './backend/pass'
import publicMetricsHandler from './backend/public-metrics'
import setWalletHandler from './backend/set-wallet-handler'
import { createTopupInvoiceHandler } from './backend/topup-invoice'
import walletNonceHandler from './backend/wallet-nonce-handler'
import { config } from './config'

const ROUTE_RATE_LIMITS: Record<string, { max: number, timeWindow: string }> = {
  '/api/auth/login': { max: 30, timeWindow: '1 minute' },
  '/api/auth/set-wallet': { max: 20, timeWindow: '1 minute' },
  '/api/auth/wallet-nonce': { max: 20, timeWindow: '1 minute' },
  '/api/users/claim': { max: 12, timeWindow: '1 minute' },
  '/api/users/claim/status': { max: 30, timeWindow: '1 minute' },
  '/api/users/leaderboard': { max: 60, timeWindow: '1 minute' },
  '/api/users/balances': { max: 60, timeWindow: '1 minute' },
  '/api/users/topup/invoice': { max: 10, timeWindow: '1 minute' },
  // Mint flow. /generate is the expensive one (paid Stability call).
  '/api/mint/quote': { max: 60, timeWindow: '1 minute' },
  '/api/mint/status': { max: 60, timeWindow: '1 minute' },
  '/api/mint/generate': { max: 6, timeWindow: '1 minute' },
  '/api/mint/submit': { max: 10, timeWindow: '1 minute' },
  '/api/mint/avatars': { max: 20, timeWindow: '1 minute' },
  '/api/mint/avatar/select': { max: 20, timeWindow: '1 minute' },
  '/api/mint/avatar/upload': { max: 10, timeWindow: '1 minute' },
  // Pass scan hits toncenter; keep it tight.
  '/api/pass/scan': { max: 10, timeWindow: '1 minute' },
  '/api/pass/select': { max: 10, timeWindow: '1 minute' },
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
  await server.register(createMintHandler(bot.api), { prefix: '/api/mint' })
  await server.register(createAvatarHandler(bot), { prefix: '/api/mint' })
  await server.register(setWalletHandler, { prefix: '/api/auth' })
  await server.register(walletNonceHandler, { prefix: '/api/auth' })
  await server.register(createPassHandler(), { prefix: '/api/pass' })

  await server.register(nftHandler, { prefix: '/api/nft' })

  await server.register(balancesHandler, { prefix: '/api/users' })
  await server.register(leaderboardHandler, { prefix: '/api/users' })
  await server.register(claimHandler, { prefix: '/api/users' })
  await server.register(createTopupInvoiceHandler(bot.api), { prefix: '/api/users' })

  await server.register(publicMetricsHandler, { prefix: '/api/public' })

  // Static app config the webview needs before/without auth: bot name
  // (referral links), donation target, collection (getgems links) and the
  // economy numbers the UI renders — never hard-coded client-side.
  server.get('/api/public/config', async () => ({
    botName: config.BOT_NAME,
    donationAddress: config.COLLECTION_OWNER,
    collectionAddress: config.COLLECTION_ADDRESS,
    generationTryCostVotes: config.GENERATION_TRY_COST_VOTES,
    referralMintRewardVotes: config.REFERRAL_MINT_REWARD_VOTES,
    starsTopupVotesPerStar: config.STARS_TOPUP_VOTES_PER_STAR,
  }))

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const frontendPath = path.join(__dirname, 'frontend')
  // The public, crawler-friendly landing lives at the root; the Vue game Mini App
  // is served under /game (Vite base '/game/'). Telegram must open /game. The
  // landing dir also holds tonconnect-manifest.json + logo.png, which TON Connect
  // and the manifest reference at the root origin.
  const landingPath = path.join(__dirname, 'landing', 'dist')

  const isGameUrl = (url: string) => url === '/game' || url.startsWith('/game/')

  const resolveLandingFile = async (url: string): Promise<string | null> => {
    const clean = (url.split('?')[0] || '/').replace(/\/+$/, '')
    const rel = clean === '' ? 'index.html' : clean.slice(1)
    const candidates = rel.endsWith('.html')
      ? [rel]
      : [path.join(rel, 'index.html'), `${rel}.html`]
    for (const candidate of candidates) {
      const abs = path.join(landingPath, candidate)
      // Guard against path traversal outside the landing dir.
      if (!abs.startsWith(landingPath + path.sep)) {
        continue
      }
      try {
        await fs.access(abs)
        return abs
      }
      catch {
        // try next candidate
      }
    }
    return null
  }

  if (config.NODE_ENV === 'development') {
    // Load vite from the frontend's own node_modules: the frontend's
    // vite.config.ts and plugins resolve there, and two copies of vite's
    // native rolldown binding in one process segfault on dlopen.
    const { createServer: createViteServer } = (await import(
      pathToFileURL(
        path.join(frontendPath, 'node_modules/vite/dist/node/index.js'),
      ).href
    )) as typeof import('vite')

    // run front with HMR — appType 'custom' so Vite only serves assets/HMR under
    // its base and we own the HTML fallback (game vs. landing) below.
    const vite = await createViteServer({
      root: frontendPath,
      appType: 'custom',
      server: { middlewareMode: true },
    })

    // Attach Vite as middleware
    server.use(vite.middlewares)

    server.setNotFoundHandler(async (req, reply) => {
      const url = req.raw.url || '/'
      if (url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'API route not found' })
      }
      if (isGameUrl(url)) {
        const indexHtml = await fs.readFile(
          path.join(frontendPath, 'index.html'),
          'utf-8',
        )
        const html = await vite.transformIndexHtml(url, indexHtml)
        return reply.type('text/html').send(html)
      }
      // Root and everything else → the multi-page landing dist.
      // Serve non-HTML landing assets (CSS, images, etc.) in dev mode.
      const clean = (url.split('?')[0] || '/').replace(/\/+$/, '')
      const rel = clean === '' ? '' : clean.slice(1)
      if (rel && !rel.endsWith('.html')) {
        const staticAbs = path.join(landingPath, rel)
        if (staticAbs.startsWith(landingPath + path.sep)) {
          try {
            const buf = await fs.readFile(staticAbs)
            const ext = path.extname(staticAbs).toLowerCase()
            const ct = ext === '.css' ? 'text/css'
              : ext === '.js' ? 'application/javascript'
              : ext === '.png' ? 'image/png'
              : ext === '.svg' ? 'image/svg+xml'
              : ext === '.json' ? 'application/json'
              : ext === '.xml' ? 'application/xml'
              : ext === '.txt' ? 'text/plain'
              : 'application/octet-stream'
            return reply.type(ct).send(buf)
          }
          catch {
            // not found, fall through to HTML resolver
          }
        }
      }
      const file = await resolveLandingFile(url)
      if (file) {
        const html = await fs.readFile(file, 'utf-8')
        return reply.type('text/html').send(html)
      }
      const notFound = await fs.readFile(path.join(landingPath, '404.html'), 'utf-8')
      return reply.status(404).type('text/html').send(notFound)
    })
  } else {
    // Landing (+ root assets: manifest, logo) at the root.
    await server.register(fastifyStatic, {
      root: landingPath,
      prefix: '/',
    })
    // The built game under /game (assets are emitted with the /game/ base).
    await server.register(fastifyStatic, {
      root: path.join(frontendPath, 'dist'),
      prefix: '/game/',
      decorateReply: false,
    })
    server.setNotFoundHandler({ preHandler: [] }, async (req, reply) => {
      const url = req.raw.url || '/'
      if (url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'API route not found' })
      }
      if (isGameUrl(url)) {
        return reply
          .type('text/html')
          .sendFile('index.html', path.join(frontendPath, 'dist'))
      }
      const file = await resolveLandingFile(url)
      if (file) {
        return reply.type('text/html').sendFile(path.relative(landingPath, file), landingPath)
      }
      return reply.status(404).type('text/html').sendFile('404.html', landingPath)
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
