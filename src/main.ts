#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import mongoose from 'mongoose'
import { onShutdown } from 'node-graceful-shutdown'
import settlementRunner from '#root/backend/expedition-settlement'
import { setMenuButton, syncBotCommands } from '#root/bot/handlers/commands/sync-commands'
import { createBot } from '#root/bot/index'
import { currentTickId } from '#root/common/helpers/tick'
import { ensureClaimUniquenessMigration } from '#root/common/models/Claim'
import { createInitialBalancesIfNotExists } from '#root/common/models/User'
import { ensureWorldsForTick } from '#root/common/models/World'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { createServer } from '#root/server'
import { Subscription } from '#root/subscription'

try {
  await mongoose.connect(config.MONGO)
  const bot = createBot(config.BOT_TOKEN, {})
  await createInitialBalancesIfNotExists()
  const migration = await ensureClaimUniquenessMigration()
  if (migration.duplicateGroups > 0) {
    logger.info(
      `Claim migration: merged ${migration.duplicateGroups} duplicate user group(s), removed ${migration.removedDocs} doc(s)`,
    )
  }

  try {
    await syncBotCommands(bot.api)
    await setMenuButton(bot.api)
  } catch (error) {
    logger.warn({ err: error }, 'Failed to sync bot commands or menu button')
  }

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

  // Seed the current tick's worlds so the board is never empty, then run
  // settlement every minute. Each run closes any tick that has rolled over
  // and is idempotent, so overlapping intervals or restarts are safe.
  await ensureWorldsForTick(currentTickId())
  const SETTLEMENT_INTERVAL_MS = 60 * 1000
  const settlementTimer = setInterval(() => {
    void (async () => {
      try {
        await ensureWorldsForTick(currentTickId())
        await settlementRunner.runOnce()
      } catch (error) {
        logger.error(error)
      }
    })()
  }, SETTLEMENT_INTERVAL_MS)
  settlementTimer.unref()

  if (config.BOT_MODE === 'webhook') {
    // to prevent receiving updates before the bot is ready
    await bot.init()

    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })

    await bot.api.setWebhook(config.BOT_WEBHOOK, {
      allowed_updates: config.BOT_ALLOWED_UPDATES,
      secret_token: config.BOT_WEBHOOK_SECRET,
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
