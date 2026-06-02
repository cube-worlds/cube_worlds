/* eslint-disable test/no-import-node-test */
import type { ReconciliationDependencies } from '#root/backend/wallet-reconciliation'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReconciliationRunner } from '#root/backend/wallet-reconciliation'

function makeDeps(overrides: Partial<ReconciliationDependencies> = {}) {
  const calls = { paused: [] as Array<{ paused: boolean, reason?: string }>, alerts: [] as string[] }
  const deps: ReconciliationDependencies = {
    appInfo: async () => ({ name: 'app', feePercents: 0, balances: [{ currency: 'USDT', balance: 10 }] }),
    sumLedger: async () => 10_000_000n, // 10 USDT in micro — matches custody
    setWithdrawalsPaused: async (paused, reason) => { calls.paused.push({ paused, reason }) },
    alert: (m) => { calls.alerts.push(m) },
    logInfo: () => {},
    ...overrides,
  }
  return { deps, calls }
}

test('matching ledger and custody keep withdrawals enabled', async () => {
  const { deps, calls } = makeDeps()
  await buildReconciliationRunner(deps).runOnce()
  assert.deepEqual(calls.paused, [{ paused: false, reason: '' }])
  assert.equal(calls.alerts.length, 0)
})

test('divergence beyond tolerance pauses withdrawals and alerts', async () => {
  const { deps, calls } = makeDeps({
    appInfo: async () => ({ name: 'app', feePercents: 0, balances: [{ currency: 'USDT', balance: 3 }] }),
    sumLedger: async () => 10_000_000n, // ledger says 10, custody says 3
  })
  await buildReconciliationRunner(deps).runOnce()
  assert.equal(calls.paused[calls.paused.length - 1].paused, true)
  assert.equal(calls.alerts.length, 1)
})

test('a tiny rounding difference within tolerance does not pause', async () => {
  const { deps, calls } = makeDeps({
    appInfo: async () => ({ name: 'app', feePercents: 0, balances: [{ currency: 'USDT', balance: 10.0000005 }] }),
    sumLedger: async () => 10_000_000n,
  })
  await buildReconciliationRunner(deps).runOnce()
  assert.equal(calls.paused[calls.paused.length - 1].paused, false)
})

test('missing USDT custody balance is treated as divergence (fail safe)', async () => {
  const { deps, calls } = makeDeps({
    appInfo: async () => ({ name: 'app', feePercents: 0, balances: [] }),
    sumLedger: async () => 10_000_000n,
  })
  await buildReconciliationRunner(deps).runOnce()
  assert.equal(calls.paused[calls.paused.length - 1].paused, true)
})
