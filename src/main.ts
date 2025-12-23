#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import { createBot } from '#root/bot/index'
import { createInitialBalancesIfNotExists } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { createServer } from '#root/server'
import { Subscription } from '#root/subscription'
import mongoose from 'mongoose'
import { onShutdown } from 'node-graceful-shutdown'

try {
  await mongoose.connect(config.MONGO)
  const bot = createBot(config.BOT_TOKEN, {})
  await createInitialBalancesIfNotExists()
  const server = await createServer(bot)

  async function shutdown() {
    logger.info('shutdown')
    await server.close()
    await bot.stop()
  }

  process.once('SIGINT', async () => await shutdown())
  process.once('SIGTERM', async () => await shutdown())

  // Graceful shutdown
  onShutdown(async () => {
    await shutdown()
  })

  const subscription = new Subscription(bot)

  void subscription.startProcessTransactions()

  if (config.BOT_MODE === 'webhook') {
    // to prevent receiving updates before the bot is ready
    await bot.init()

    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })

    await bot.api.setWebhook(config.BOT_WEBHOOK, {
      allowed_updates: config.BOT_ALLOWED_UPDATES,
    })
  } else if (config.BOT_MODE === 'polling') {
    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })
    await bot.start()
  }
} catch (error) {
  logger.error(error)
  process.exit(1)
}
