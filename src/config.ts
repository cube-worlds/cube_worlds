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
    // Empty ⇒ unset; required in webhook mode (enforced after parsing below).
    // The empty-string escape keeps polling mode bootable without a secret —
    // a bare .min(16).default('') would reject its own default. A refine
    // (not .or(z.literal(''))) because znv doesn't support ZodUnion.
    BOT_WEBHOOK_SECRET: z
      .string()
      .refine(
        s => s === '' || /^[\w-]{16,256}$/.test(s),
        'BOT_WEBHOOK_SECRET must be 16-256 chars of [A-Za-z0-9_-]',
      )
      .default(''),
    BOT_SERVER_HOST: z.string().default('0.0.0.0'),
    BOT_SERVER_PORT: port().default(80),
    BOT_ALLOWED_UPDATES: z
      .array(z.enum(API_CONSTANTS.ALL_UPDATE_TYPES))
      .default([]),
    MONGO: z.string(),
    BOT_ADMINS: z.array(z.number()).default([]),
    // Staging guard: when true, skip the on-chain tx-processing loop AND all
    // Telegram engagement (no setWebhook/polling). Lets us validate boot,
    // mongo, Fastify, SPA + /api on axveer without a second instance touching
    // the live MNEMONICS wallet or hijacking the live webhook. Default off.
    STAGING: z.boolean().default(false),
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
    // Price of one NFT-image generation try, in $CUBE (votes). Tunable.
    GENERATION_TRY_COST_VOTES: z.number().int().default(100),
    // Telegram Stars top-up: $CUBE (votes) credited per 1 Star. Tunable.
    STARS_TOPUP_VOTES_PER_STAR: z.number().int().default(10),
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
