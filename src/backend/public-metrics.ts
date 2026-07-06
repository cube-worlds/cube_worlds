import type { PublicMetrics } from '#root/backend/public-metrics-handler'
import { buildPublicMetricsHandler } from '#root/backend/public-metrics-handler'
import { totalPaidOut } from '#root/common/models/RewardsPoolLedger'
import { countActiveSince, countAllWallets, countMinted } from '#root/common/models/User'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function fetchMetrics(): Promise<PublicMetrics> {
  const since = new Date(Date.now() - WEEK_MS)
  const [players, minted, paidOut, activeWeek] = await Promise.all([
    countAllWallets(),
    countMinted(),
    totalPaidOut(),
    countActiveSince(since),
  ])
  return {
    players,
    minted,
    paidOutMicroUsdt: paidOut.toString(),
    activeWeek,
  }
}

const publicMetricsHandler = buildPublicMetricsHandler({
  fetchMetrics,
  now: () => Date.now(),
  cacheTtlMs: 60_000,
})

export default publicMetricsHandler
