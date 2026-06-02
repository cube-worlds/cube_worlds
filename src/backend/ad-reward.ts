import { issueAdNonce, verifyAdNonce } from '#root/common/helpers/ad-nonce'
import { accrueShare } from '#root/common/helpers/rewards'
import { usdtToMicro } from '#root/common/helpers/wallet'
import { countAdGrantsToday, recordAdGrant, utcDay } from '#root/common/models/AdGrant'
import { grantEnergy } from '#root/common/models/Energy'
import { accrueRewards } from '#root/common/models/RewardsPoolLedger'
import { findUserById } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { buildAdRewardHandler } from './ad-reward-handler'
import { defaultParseInitData, defaultValidateInitData } from './init-data'

const adRewardHandler = buildAdRewardHandler({
  validateInitData: defaultValidateInitData,
  parseInitData: defaultParseInitData,
  findUserById,
  adBlockId: () => config.ADSGRAM_BLOCK_ID,
  issueAdNonce: userId => issueAdNonce(config.ADSGRAM_REWARD_SECRET, userId),
  verifyAdNonce: (payload, now) => verifyAdNonce(config.ADSGRAM_REWARD_SECRET, payload, now),
  utcDay,
  countAdGrantsToday,
  recordAdGrant,
  grantEnergy: (user, amount) => grantEnergy(user, amount),
  accrueRewards,
  adRevenueMicro: () => usdtToMicro(config.AD_REVENUE_PER_VIEW_USDT),
  accrueShare,
  now: () => Date.now(),
  logError: logger.error.bind(logger),
})

export default adRewardHandler
