#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import mongoose from 'mongoose'
import { onShutdown } from 'node-graceful-shutdown'
import bossSettlementRunner from '#root/backend/boss-settlement-runner'
import castleMintRunner from '#root/backend/castle-mint-runner'
import { isCastleMintEnabled } from '#root/backend/castle-nft-client'
import equipmentMintRunner from '#root/backend/equipment-mint-runner'
import { isEquipmentMintEnabled } from '#root/backend/equipment-nft-client'
import settlementRunner from '#root/backend/expedition-settlement-runner'
import heroMintRunner from '#root/backend/hero-mint-runner'
import { isHeroMintEnabled } from '#root/backend/hero-nft-client'
import tournamentSettlementRunner from '#root/backend/tournament-settlement-runner'
import reconciliationRunner from '#root/backend/wallet-reconciliation-runner'
import { isMoneyRailEnabled } from '#root/backend/xrocket-client'
import { setMenuButton, syncBotCommands } from '#root/bot/handlers/commands/sync-commands'
import { createBot } from '#root/bot/index'
import { currentTickId } from '#root/common/helpers/tick'
import { currentWeekId } from '#root/common/helpers/tournament'
import { ensureClaimUniquenessMigration } from '#root/common/models/Claim'
import { findOrCreateTournament } from '#root/common/models/Tournament'
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

  // Boss-week settlement: awards tiered Equipment to top contributors of any
  // CLOSED week. Idempotent per (week, user), so overlapping runs are safe.
  const BOSS_SETTLEMENT_INTERVAL_MS = 10 * 60 * 1000
  const bossSettlementTimer = setInterval(() => {
    void (async () => {
      try {
        await bossSettlementRunner.runOnce()
      } catch (error) {
        logger.error(error)
      }
    })()
  }, BOSS_SETTLEMENT_INTERVAL_MS)
  bossSettlementTimer.unref()

  if (isCastleMintEnabled()) {
    const CASTLE_MINT_INTERVAL_MS = 5 * 60 * 1000
    const castleMintTimer = setInterval(() => {
      void (async () => {
        try {
          await castleMintRunner.runOnce()
        } catch (error) {
          logger.error(error)
        }
      })()
    }, CASTLE_MINT_INTERVAL_MS)
    castleMintTimer.unref()
  }

  if (isHeroMintEnabled()) {
    const HERO_MINT_INTERVAL_MS = 5 * 60 * 1000
    const heroMintTimer = setInterval(() => {
      void (async () => {
        try {
          await heroMintRunner.runOnce()
        } catch (error) {
          logger.error(error)
        }
      })()
    }, HERO_MINT_INTERVAL_MS)
    heroMintTimer.unref()
  }

  if (isEquipmentMintEnabled()) {
    const EQUIPMENT_MINT_INTERVAL_MS = 5 * 60 * 1000
    const equipmentMintTimer = setInterval(() => {
      void (async () => {
        try {
          await equipmentMintRunner.runOnce()
        } catch (error) {
          logger.error(error)
        }
      })()
    }, EQUIPMENT_MINT_INTERVAL_MS)
    equipmentMintTimer.unref()
  }

  // Hourly reconciliation: compare local USDT ledger against xRocket custody and
  // pause withdrawals on divergence. Only runs when the money rail is configured.
  if (isMoneyRailEnabled()) {
    const RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000
    const reconciliationTimer = setInterval(() => {
      void (async () => {
        try {
          await reconciliationRunner.runOnce()
        } catch (error) {
          logger.error(error)
        }
      })()
    }, RECONCILIATION_INTERVAL_MS)
    reconciliationTimer.unref()
    // Run once at boot so a divergence present at startup pauses immediately.
    void reconciliationRunner.runOnce().catch(error => logger.error(error))

    // Weekly tournament: seed the current week, then settle any closed week and
    // pay winners from the rewards pool. The interval is short so a just-closed
    // week settles promptly; each run is idempotent. Requires the money rail
    // (payouts go through xRocket).
    await findOrCreateTournament(currentWeekId())
    const TOURNAMENT_INTERVAL_MS = 5 * 60 * 1000
    const tournamentTimer = setInterval(() => {
      void (async () => {
        try {
          await findOrCreateTournament(currentWeekId())
          await tournamentSettlementRunner.runOnce()
        } catch (error) {
          logger.error(error)
        }
      })()
    }, TOURNAMENT_INTERVAL_MS)
    tournamentTimer.unref()
  }

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
  // Not logger.error: pino's transport runs in a worker thread that may not
  // have started (let alone flushed) by the time process.exit fires, which
  // swallows the message and makes startup crashes silent. console.error
  // writes to stderr synchronously and can't be lost.
  console.error(error)
  process.exit(1)
}
