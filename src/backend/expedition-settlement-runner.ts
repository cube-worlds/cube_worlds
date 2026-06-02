import { config } from '#root/config'
import { buildSettlementRunner, createDefaultDependencies } from './expedition-settlement'

// Config-bound wiring: injects the production faucet gate. The pure
// expedition-settlement.ts stays config-free for tests; this composer adds the
// `EXPEDITION_FAUCET_ENABLED` flag, so nothing a test imports reads config.
const expeditionSettlementRunner = buildSettlementRunner({
  ...createDefaultDependencies(),
  faucetEnabled: () => config.EXPEDITION_FAUCET_ENABLED,
})

export default expeditionSettlementRunner
