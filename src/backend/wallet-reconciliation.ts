import type { AppInfo } from '#root/common/helpers/xrocket'
import { MICRO_PER_USDT, WALLET_CURRENCY } from '#root/common/helpers/wallet'

// Allowed |ledger - custody| before we treat it as a real divergence. 1000
// micro-USDT (0.001 USDT) absorbs float/rounding noise from xRocket's number API.
const TOLERANCE_MICRO = 1000n

export interface ReconciliationDependencies {
  appInfo: () => Promise<AppInfo>
  sumLedger: (currency?: string) => Promise<bigint>
  setWithdrawalsPaused: (paused: boolean, reason?: string) => Promise<void>
  alert: (message: string) => void
  logInfo: (message: string) => void
}

// Pure, config-free runner. The composer (`wallet-reconciliation-runner.ts`)
// wires the config-bound xRocket client + logger; tests inject fakes. Keeping
// this module free of `#root/config` (transitively) is why the wiring is split.
export function buildReconciliationRunner(deps: ReconciliationDependencies) {
  async function runOnce(): Promise<void> {
    const info = await deps.appInfo()
    const custody = info.balances.find(b => b.currency === WALLET_CURRENCY)
    const ledgerMicro = await deps.sumLedger(WALLET_CURRENCY)

    if (!custody) {
      await deps.setWithdrawalsPaused(true, 'No USDT custody balance reported by xRocket')
      deps.alert(`Reconciliation: xRocket reported no ${WALLET_CURRENCY} balance; pausing withdrawals`)
      return
    }

    const custodyMicro = BigInt(Math.round(custody.balance * Number(MICRO_PER_USDT)))
    const diff = custodyMicro - ledgerMicro
    const absDiff = diff < 0n ? -diff : diff

    if (absDiff > TOLERANCE_MICRO) {
      await deps.setWithdrawalsPaused(true, `Ledger/custody divergence: ${diff} micro-USDT`)
      deps.alert(`Reconciliation: divergence of ${diff} micro-USDT (custody ${custodyMicro}, ledger ${ledgerMicro}); withdrawals paused`)
      return
    }

    await deps.setWithdrawalsPaused(false, '')
    deps.logInfo(`Reconciliation OK: custody ${custodyMicro} vs ledger ${ledgerMicro} micro-USDT`)
  }

  return { runOnce }
}
