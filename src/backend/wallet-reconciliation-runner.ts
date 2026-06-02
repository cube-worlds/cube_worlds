import { setWithdrawalsPaused } from '#root/common/models/WalletGuard'
import { sumLedger } from '#root/common/models/WalletLedger'
import { logger } from '#root/logger'
import { buildReconciliationRunner } from './wallet-reconciliation'
import xrocketClient from './xrocket-client'

// Config-bound wiring for the reconciliation worker. This module imports the
// config-bound xRocket client, so nothing a test imports may import it.
const reconciliationRunner = buildReconciliationRunner({
  appInfo: () => xrocketClient.appInfo(),
  sumLedger: currency => sumLedger(currency),
  setWithdrawalsPaused,
  alert: logger.error.bind(logger),
  logInfo: logger.info.bind(logger),
})

export default reconciliationRunner
