import process from 'node:process'
import { API_CONSTANTS } from 'grammy'
import { parseEnv, port, z } from 'znv'
import 'dotenv/config'

function createConfigFromEnvironment(environment: NodeJS.ProcessEnv) {
  const config = parseEnv(environment, {
    NODE_ENV: z.enum(['development', 'production']),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    BOT_MODE: {
      schema: z.enum(['polling', 'webhook']),
      defaults: {
        production: 'webhook' as const,
        development: 'polling' as const,
      },
    },
    BOT_TOKEN: z.string(),
    BOT_NAME: z.string().default('cube_worlds_bot'),
    BOT_WEBHOOK: z.string().default(''),
    BOT_WEBHOOK_SECRET: z
      .string()
      .regex(/^[\w-]+$/, 'BOT_WEBHOOK_SECRET must be alphanumeric (with _-)')
      .min(16)
      .max(256)
      .default(''),
    BOT_SERVER_HOST: z.string().default('0.0.0.0'),
    BOT_SERVER_PORT: port().default(80),
    BOT_ALLOWED_UPDATES: z
      .array(z.enum(API_CONSTANTS.ALL_UPDATE_TYPES))
      .default([]),
    MONGO: z.string(),
    BOT_ADMINS: z.array(z.number()).default([]),
    WEB_APP_URL: z.string().url(),
    ALLOWED_ORIGINS: z.array(z.string()).default([]),
    // Number of proxy hops to trust for X-Forwarded-For. Set this to match
    // your deployment: 1 for a single proxy (nginx, k8s ingress, Cloudflare
    // alone), 2 for stacked proxies. Leaving it at 0 means every request's
    // IP resolves to the immediate TCP peer, which makes per-IP rate limits
    // global — but is the safe choice if no proxy is present.
    TRUSTED_PROXY_HOPS: {
      schema: z.number().int().min(0).max(10),
      defaults: {
        production: 1,
        development: 0,
      },
    },
    COLLECTION_ADDRESS: z.string(),
    COLLECTION_OWNER: z.string(),
    MNEMONICS: z.string(),
    PINATA_API_KEY: z.string(),
    PINATA_API_SECRET: z.string(),
    PINATA_GATEWAY: z.string(),
    PINATA_GATEWAY_KEY: z.string(),
    TONCENTER_API_KEY: z.string(),
    TESTNET: z.boolean().default(true),
    STABILITY_API_KEY: z.string(),
    OPENAI_API_KEY: z.string(),
    TELEMETREE_API_KEY: z.string(),
    TELEMETREE_PROJECT_ID: z.string(),
    XROCKET_API_KEY: z.string().default(''),
    XROCKET_BASE_URL: z.string().url().default('https://pay.testnet.xrocket.exchange/api'),
    // Adsgram rewarded ads. Empty block id / secret ⇒ ads disabled.
    ADSGRAM_BLOCK_ID: z.string().default(''),
    ADSGRAM_REWARD_SECRET: z.string().default(''),
    // Estimated net USD value of one verified rewarded-ad view; drives the
    // rewards-pool accrual. Tunable — see docs/ECONOMY.md.
    AD_REVENUE_PER_VIEW_USDT: z.number().default(0.003),
    // Season Pass (Telegram Stars): price in Stars (XTR), 30-day subscription.
    SEASON_PASS_STARS: z.number().int().default(150),
    // Estimated net USD value of one Season Pass charge (for the accrual).
    SEASON_PASS_REVENUE_USDT: z.number().default(1.8),
    // Rewards pool share of net revenue, in basis points (2000 = 20%). Invariant.
    REWARDS_POOL_BPS: z.number().int().default(2000),
    // Production gate: the expedition CUBE faucet stays OFF until enabled. Flip
    // to true only once the three sinks are live (refill, weight-boost,
    // tournament entry).
    EXPEDITION_FAUCET_ENABLED: z.boolean().default(false),
  })

  if (config.BOT_MODE === 'webhook') {
    // validate webhook url in webhook mode
    z.string()
      .url()
      .parse(config.BOT_WEBHOOK, {
        path: ['BOT_WEBHOOK'],
      })
    if (!config.BOT_WEBHOOK_SECRET) {
      throw new Error(
        'BOT_WEBHOOK_SECRET is required in webhook mode (16-256 chars, [A-Za-z0-9_-])',
      )
    }
  }

  return {
    ...config,
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
  }
}

export type Config = ReturnType<typeof createConfigFromEnvironment>

let _config: Config | null = null

function getConfig(): Config {
  if (!_config) {
    _config = createConfigFromEnvironment(process.env)
  }
  return _config
}

export const config: Config = new Proxy({} as Config, {
  get(_, prop) {
    return getConfig()[prop as keyof Config]
  },
})
