import { currentWeekId, weekEnd, weekStart } from '#root/common/helpers/tournament'
import { microToUsdt, WALLET_CURRENCY } from '#root/common/helpers/wallet'
import { sumExpeditionCubeByUser } from '#root/common/models/Balance'
import { poolBalance, recordPayout } from '#root/common/models/RewardsPoolLedger'
import { findUnsettledTournaments, markTournamentSettled } from '#root/common/models/Tournament'
import { claimPayout, findEntries, findUnpaidWinners, setEntryResult } from '#root/common/models/TournamentEntry'
import { findUserById } from '#root/common/models/User'
import { areWithdrawalsPaused } from '#root/common/models/WalletGuard'
import { logger } from '#root/logger'
import { buildTournamentSettlementRunner } from './tournament-settlement'
import xrocketClient from './xrocket-client'

// Account-age anti-Sybil gate: a payout requires a minimum account age. This is
// the MVP gate — fold in the shared behavioral suspicion rail when it lands.
const PAYOUT_MIN_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000

async function payoutEligible(userId: number): Promise<boolean> {
  const user = await findUserById(userId)
  if (!user)
    return false
  const createdAt = (user as { createdAt?: Date }).createdAt
  if (!createdAt)
    return true // legacy users without a timestamp: allow
  return Date.now() - createdAt.getTime() >= PAYOUT_MIN_ACCOUNT_AGE_MS
}

// Config-bound wiring (imports the config-bound xRocket client), so nothing a
// test imports may import this module.
const tournamentSettlementRunner = buildTournamentSettlementRunner({
  currentWeekId: () => currentWeekId(),
  findUnsettledTournaments: week => findUnsettledTournaments(week) as never,
  findEntries: weekId => findEntries(weekId) as never,
  scoreForWeek: (weekId, userIds) =>
    sumExpeditionCubeByUser(weekStart(weekId), weekEnd(weekId), userIds),
  payoutEligible,
  setEntryResult,
  markTournamentSettled,
  poolBalance,
  findUnpaidWinners: () => findUnpaidWinners() as never,
  claimPayout,
  recordPayout,
  payUser: (tgUserId, amountUsdt, payoutId) =>
    xrocketClient
      .transfer({
        tgUserId,
        currency: WALLET_CURRENCY,
        amount: amountUsdt,
        transferId: payoutId,
        description: 'Cube Worlds tournament prize',
      })
      .then(() => undefined),
  microToUsdt,
  areWithdrawalsPaused,
  logInfo: logger.info.bind(logger),
  logError: logger.error.bind(logger),
})

export default tournamentSettlementRunner
