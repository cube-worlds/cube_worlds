/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { CubeBridgeHandlerDependencies } from '#root/backend/cube-bridge-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildCubeBridgeHandler } from '#root/backend/cube-bridge-handler'

const WITHDRAW_BASE = 9_999_999_999

function makeDeps(overrides: Partial<CubeBridgeHandlerDependencies> = {}) {
  const calls = {
    debited: [] as any[],
    refunds: [] as any[],
    inserted: [] as any[],
    sent: [] as any[],
    status: [] as any[],
  }
  let balance = 10_000n
  const deps: CubeBridgeHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, votes: balance, wallet: 'EQuser' } as any) : null),
    vaultAddress: () => 'EQvault',
    lastWithdrawAt: async () => null,
    now: () => new Date(WITHDRAW_BASE),
    debitVotes: async (_id, amount) => {
      if (balance < amount) return null
      balance -= amount
      calls.debited.push({ amount })
      return balance
    },
    addPoints: async (_id, add) => {
      balance += add
      calls.refunds.push({ add })
      return balance
    },
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

test('withdraw uses atomic debit, sends net, completes the ledger row, no refund', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.net, '980')
  assert.equal(calls.debited[0].amount, 1000n)
  assert.deepEqual(calls.sent[0], { to: 'EQuser', net: 980n })
  assert.equal(calls.status[calls.status.length - 1].status, 'completed')
  assert.equal(calls.refunds.length, 0)
})

test('withdraw rejected without a bound wallet', async (t) => {
  const { deps, calls } = makeDeps({ findUserById: async () => ({ id: 7, votes: 10_000n } as any) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'No wallet bound')
  assert.equal(calls.debited.length, 0)
})

test('withdraw blocked by cooldown', async (t) => {
  const { deps, calls } = makeDeps({ lastWithdrawAt: async () => new Date(WITHDRAW_BASE - 1000) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Withdraw cooldown active')
  assert.equal(calls.debited.length, 0)
})

test('withdraw rejects insufficient balance atomically, no send', async (t) => {
  // Balance is 10n (below the 1000 request) — debitVotes returns null
  const { deps, calls } = makeDeps({
    findUserById: async () => ({ id: 7, votes: 10n, wallet: 'EQuser' } as any),
    debitVotes: async () => null,
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.sent.length, 0)
  assert.equal(calls.inserted.length, 0)
})

test('withdraw refunds CUBE and marks failed when the chain send throws', async (t) => {
  const { deps, calls } = makeDeps({ sendCubeJetton: async () => { throw new Error('chain down') } })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  assert.equal(res.json().error, 'Withdraw failed, CUBE refunded')
  assert.equal(calls.debited[0].amount, 1000n)
  assert.equal(calls.refunds[0].add, 1000n)
  assert.equal(calls.status[calls.status.length - 1].status, 'failed')
})

test('mark-complete throws after successful send: ok:true returned, no refund', async (t) => {
  const { deps, calls } = makeDeps({
    markBridgeStatus: async (id, s) => {
      if (s === 'completed') throw new Error('db blip')
      calls.status.push({ id, s })
    },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } })
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(calls.sent.length, 1)
  assert.equal(calls.refunds.length, 0)
})

test('concurrent withdraws with same balance: exactly one succeeds, no over-send', async (t) => {
  // Shared balance 1000n — two simultaneous 1000-CUBE requests
  let balance = 1000n
  const sent: any[] = []
  const debitVotes = async (_id: number, amount: bigint) => {
    if (balance < amount) return null
    balance -= amount
    return balance
  }
  const sendCubeJetton = async (to: string, net: bigint) => { sent.push({ to, net }); return 'tx' }
  const { deps } = makeDeps({ debitVotes, sendCubeJetton })
  const app = await appWith(deps)
  t.after(() => app.close())
  const [r1, r2] = await Promise.all([
    app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } }),
    app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1000' } }),
  ])
  const bodies = [r1.json(), r2.json()]
  const successes = bodies.filter(b => b.ok === true)
  const failures = bodies.filter(b => b.error === 'Not enough CUBE')
  assert.equal(successes.length, 1)
  assert.equal(failures.length, 1)
  assert.equal(sent.length, 1)
})

test('withdraw rejects non-integer amount', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '1.5' } })
  assert.equal(res.json().error, 'Invalid amount')
})

test('withdraw rejects amount below minimum', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/cube/withdraw', payload: { initData: 'x', amount: '-100' } })
  assert.equal(res.json().error, 'Amount below minimum')
})
