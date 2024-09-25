import "dotenv/config"
import z from "zod"
import { parseEnv, port } from "znv"
import { API_CONSTANTS } from "grammy"

const createConfigFromEnvironment = (environment: NodeJS.ProcessEnv) => {
  const config = parseEnv(environment, {
    NODE_ENV: z.enum(["development", "production"]),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    BOT_MODE: {
      schema: z.enum(["polling", "webhook"]),
      defaults: {
        production: "webhook" as const,
        development: "polling" as const,
      },
    },
    BOT_TOKEN: z.string(),
    BOT_NAME: z.string().default("cube_worlds_bot"),
    BOT_WEBHOOK: z.string().default(""),
    BOT_SERVER_HOST: z.string().default("0.0.0.0"),
    BOT_SERVER_PORT: port().default(80),
    BOT_ALLOWED_UPDATES: z.array(z.enum(API_CONSTANTS.ALL_UPDATE_TYPES)).default([]),
    MONGO: z.string(),
    BOT_ADMINS: z.array(z.number()).default([]),
    WEB_APP_URL: z.string().url(),
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
    TAPPADS_SECRET_URL: z.string(),
  })

  if (config.BOT_MODE === "webhook") {
    // validate webhook url in webhook mode
    z.string()
      .url()
      .parse(config.BOT_WEBHOOK, {
        path: ["BOT_WEBHOOK"],
      })
  }

  return {
    ...config,
    isDev: process.env.NODE_ENV === "development",
    isProd: process.env.NODE_ENV === "production",
  }
}

export type Config = ReturnType<typeof createConfigFromEnvironment>

export const config = createConfigFromEnvironment(process.env)
