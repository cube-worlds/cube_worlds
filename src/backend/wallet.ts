import { randomId } from '#root/common/helpers/random'
import { grantEnergy } from '#root/common/models/Energy'
import { findUserById } from '#root/common/models/User'
import { applyDebit, creditBalance, getBalance } from '#root/common/models/WalletBalance'
import { areWithdrawalsPaused } from '#root/common/models/WalletGuard'
import { insertLedgerEntry, setLedgerStatus } from '#root/common/models/WalletLedger'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildWalletHandler } from './wallet-handler'
import xrocketClient from './xrocket-client'

const walletHandler = buildWalletHandler({
  validateInitData: defaultValidateInitData,
  parseInitData: defaultParseInitData,
  findUserById,
  getBalance,
  applyDebit,
  creditBalance,
  grantEnergy: (user, amount) => grantEnergy(user, amount),
  insertLedgerEntry: entry => insertLedgerEntry(entry) as never,
  setLedgerStatus,
  areWithdrawalsPaused,
  generateId: () => randomId(),
  callbackUrl: () => `${config.WEB_APP_URL.replace(/\/$/, '')}/api/wallet/webhook`,
  xrocket: xrocketClient,
  logError: logger.error.bind(logger),
})

export default walletHandler
