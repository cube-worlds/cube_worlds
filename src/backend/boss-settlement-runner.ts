import { currentWeekId } from '#root/common/helpers/tournament'
import { aggregateDamageByUser, distinctAttackWeeks } from '#root/common/models/BossAttack'
import { claimBossReward, linkRewardEquipment } from '#root/common/models/BossReward'
import { createEquipment } from '#root/common/models/Equipment'
import { logger } from '#root/logger'
import { buildBossSettlementRunner } from './boss-settlement'

// Config-free wiring: the pure boss-settlement.ts is injected the real models and
// the (pure) week clock. Runs unconditionally — it only ever acts on CLOSED weeks
// and grants resource/item rewards (no money rail, no faucet flag).
const bossSettlementRunner = buildBossSettlementRunner({
  currentWeekId: () => currentWeekId(),
  distinctAttackWeeks,
  aggregateDamageByUser,
  claimBossReward,
  createEquipment: input => createEquipment(input) as never,
  linkRewardEquipment,
  logInfo: logger.info.bind(logger),
  logError: logger.error.bind(logger),
})

export default bossSettlementRunner
