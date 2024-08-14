#!/usr/bin/env tsx
import { onShutdown } from "node-graceful-shutdown"
import mongoose from "mongoose"
import { createBot } from "#root/bot/index.js"
import { config } from "#root/config.js"
import { logger } from "#root/logger.js"
import { createServer } from "#root/server.js"
import { Subscription } from "#root/subscription.js"
import { createInitialBalancesIfNotExists } from "#root/bot/models/user.js"

try {
  await mongoose.connect(config.MONGO)
  const bot = createBot(config.BOT_TOKEN, {})
  await createInitialBalancesIfNotExists()
  const server = await createServer(bot)

  // Graceful shutdown
  onShutdown(async () => {
    logger.info("shutdown")

    await server.close()
    await bot.stop()
  })

  const subscription = new Subscription(bot)
  // eslint-disable-next-line no-void
  void subscription.startProcessTransactions()

  if (config.BOT_MODE === "webhook") {
    // to prevent receiving updates before the bot is ready
    await bot.init()

    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })

    await bot.api.setWebhook(config.BOT_WEBHOOK, {
      allowed_updates: config.BOT_ALLOWED_UPDATES,
    })
  } else if (config.BOT_MODE === "polling") {
    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })
    await bot.start({
      allowed_updates: config.BOT_ALLOWED_UPDATES,
      onStart: ({ username }) =>
        logger.info({
          msg: "Bot running...",
          username,
        }),
    })
  }
} catch (error) {
  logger.error(error)
  process.exit(1)
}
