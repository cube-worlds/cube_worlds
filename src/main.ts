#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import mongoose from 'mongoose'
import { onShutdown } from 'node-graceful-shutdown'
import { setMenuButton, syncBotCommands } from '#root/bot/handlers/commands/sync-commands'
import { createBot } from '#root/bot/index'
import { ensureClaimUniquenessMigration } from '#root/common/models/Claim'
import { createInitialBalancesIfNotExists } from '#root/common/models/User'
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

  // NEVER in staging: with the production BOT_TOKEN this would repoint the
  // LIVE bot's menu button at the staging WEB_APP_URL. Staging must not touch
  // Telegram at all.
  if (!config.STAGING) {
    try {
      await syncBotCommands(bot.api)
      const menuButton = await setMenuButton(bot.api)
      if (menuButton.changed) {
        logger.info(
          `Menu button updated: ${menuButton.previousUrl ?? '(none)'} → ${menuButton.url}`,
        )
      } else {
        logger.info(`Menu button already current (${menuButton.url})`)
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to sync bot commands or menu button')
    }
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

  if (config.STAGING) {
    // Staging guard: never run a second tx-processing loop against the live
    // MNEMONICS wallet while legacy is still up (double-mint risk), never touch
    // the live Telegram webhook, and run no background settlement/mint workers
    // against the shared DB. Just listen so health/SPA/api can be validated on
    // axveer. The full runtime engages only on the real cutover (STAGING off).
    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    })
    logger.warn('STAGING mode: tx-processing loop, background workers, and Telegram disabled')
  } else {
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
        secret_token: config.BOT_WEBHOOK_SECRET,
      })
    } else if (config.BOT_MODE === 'polling') {
      await server.listen({
        host: config.BOT_SERVER_HOST,
        port: config.BOT_SERVER_PORT,
      })
      await bot.start()
    }
  }
} catch (error) {
  // Not logger.error: pino's transport runs in a worker thread that may not
  // have started (let alone flushed) by the time process.exit fires, which
  // swallows the message and makes startup crashes silent. console.error
  // writes to stderr synchronously and can't be lost.
  console.error(error)
  process.exit(1)
}
