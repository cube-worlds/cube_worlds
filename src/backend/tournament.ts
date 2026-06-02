import { currentWeekId, TOURNAMENT_ENTRY_CUBE, weekEnd, weekStart } from '#root/common/helpers/tournament'
import { BalanceChangeType, sumExpeditionCubeByUser } from '#root/common/models/Balance'
import { poolBalance } from '#root/common/models/RewardsPoolLedger'
import { isSeasonPassActive } from '#root/common/models/SeasonPass'
import { findOrCreateTournament, findTournament, incrementEntrants } from '#root/common/models/Tournament'
import { enterTournament, findEntries } from '#root/common/models/TournamentEntry'
import { addPoints, findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildTournamentHandler } from './tournament-handler'

const tournamentHandler = buildTournamentHandler({
  validateInitData: defaultValidateInitData,
  parseInitData: defaultParseInitData,
  findUserById,
  currentWeekId: () => currentWeekId(),
  weekEndMs: weekId => weekEnd(weekId).getTime(),
  entryFeeCube: TOURNAMENT_ENTRY_CUBE,
  findOrCreateTournament,
  findTournament: weekId => findTournament(weekId) as never,
  enterTournament: (userId, weekId, bonus) => enterTournament(userId, weekId, bonus) as never,
  incrementEntrants,
  findEntries: weekId => findEntries(weekId) as never,
  isSeasonPassActive: userId => isSeasonPassActive(userId),
  addPoints,
  spendReason: BalanceChangeType.Spend,
  poolBalance,
  scoreForWeek: (weekId, userIds) =>
    sumExpeditionCubeByUser(weekStart(weekId), weekEnd(weekId), userIds),
  logError: logger.error.bind(logger),
})

export default tournamentHandler
