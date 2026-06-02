import { creditBalance } from '#root/common/models/WalletBalance'
import { insertLedgerEntry, setLedgerStatus } from '#root/common/models/WalletLedger'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { buildWalletWebhookHandler } from './wallet-webhook-handler'

const walletWebhookHandler = buildWalletWebhookHandler({
  apiKey: () => config.XROCKET_API_KEY,
  insertLedgerEntry: entry => insertLedgerEntry(entry) as never,
  setLedgerStatus,
  creditBalance,
  logError: logger.error.bind(logger),
})

export default walletWebhookHandler
