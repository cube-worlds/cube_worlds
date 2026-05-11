import type { Context } from '#root/bot/context'
import { userStats } from '#root/common/models/User'

export interface StatsHandlerDependencies {
  userStats: () => Promise<{
    all: number
    notMinted: number
    minted: number
    month: number
    week: number
    day: number
  }>
}

function createDefaultDependencies(): StatsHandlerDependencies {
  return { userStats }
}

export function buildStatsCommandHandler(
  deps: StatsHandlerDependencies = createDefaultDependencies(),
) {
  return async function handleStats(ctx: Context) {
    const stats = await deps.userStats()
    return ctx.reply(`All: ${stats.all}
With wallet: ${stats.notMinted}
NFT minted: ${stats.minted}

Active month: ${stats.month}
Active week: ${stats.week}
Active day: ${stats.day}
`)
  }
}
