/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { CubeBridgeHandlerDependencies } from '#root/backend/cube-bridge-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildCubeBridgeHandler } from '#root/backend/cube-bridge-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

const WITHDRAW_BASE = 9_999_999_999

function makeDeps(overrides: Partial<CubeBridgeHandlerDependencies> = {}) {
  const calls = { addPoints: [] as any[], inserted: [] as any[], sent: [] as any[], status: [] as any[] }
  const deps: CubeBridgeHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, votes: 10_000n, wallet: 'EQuser' } as any) : null),
    vaultAddress: () => 'EQvault',
    lastWithdrawAt: async () => null,
    now: () => new Date(WITHDRAW_BASE),
    addPoints: async (_id, add, reason) => { calls.addPoints.push({ add, reason }); return 9_000n },
    insertBridgeRow: async (row) => { calls.inserted.push(row); return true },
    randomExternalId: () => 'wd-abc',
    sendCubeJetton: async (to, net) => { calls.sent.push({ to, net }); return 'tx-hash' },
    markBridgeStatus: async (id, status) => { calls.status.push({ id, status }) },
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: CubeBridgeHandlerDependencies) {
  const app = fastify()
  await app.register(buildCubeBridgeHandler(d), { prefix: '/api/cube' })
  return app
}

test('status returns balance, vault address, and withdraw eligibility', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/status', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.balance, '10000')
  assert.equal(body.depositAddress, 'EQvault')
  assert.equal(body.canWithdraw, true)
})

test('withdraw debits gross, sends net, completes the ledger row', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.net, '980')
  assert.equal(calls.addPoints[0].add, -1000n)
  assert.equal(calls.addPoints[0].reason, BalanceChangeType.Withdraw)
  assert.deepEqual(calls.sent[0], { to: 'EQuser', net: 980n })
  assert.equal(calls.status[calls.status.length - 1].status, 'completed')
})

test('withdraw rejected without a bound wallet', async (t) => {
  const { deps, calls } = makeDeps({ findUserById: async () => ({ id: 7, votes: 10_000n } as any) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'No wallet bound')
  assert.equal(calls.addPoints.length, 0)
})

test('withdraw blocked by cooldown', async (t) => {
  const { deps, calls } = makeDeps({ lastWithdrawAt: async () => new Date(WITHDRAW_BASE - 1000) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Withdraw cooldown active')
  assert.equal(calls.addPoints.length, 0)
})

test('withdraw refunds CUBE and marks failed when the chain send throws', async (t) => {
  const { deps, calls } = makeDeps({ sendCubeJetton: async () => { throw new Error('chain down') } })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Withdraw failed, CUBE refunded')
  assert.equal(calls.addPoints[0].add, -1000n)
  assert.equal(calls.addPoints[1].add, 1000n)
  assert.equal(calls.status[calls.status.length - 1].status, 'failed')
})

test('withdraw rejects insufficient balance before any debit', async (t) => {
  const { deps, calls } = makeDeps({ findUserById: async () => ({ id: 7, votes: 10n, wallet: 'EQuser' } as any) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.addPoints.length, 0)
})
