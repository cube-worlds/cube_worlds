/* eslint-disable test/no-import-node-test */
import type { SettlementEntry, TournamentSettlementDependencies } from '#root/backend/tournament-settlement'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTournamentSettlementRunner } from '#root/backend/tournament-settlement'

interface EntryState {
  _id: string
  userId: number
  weekId: number
  scoreCube: bigint
  rank: number
  payoutMicro: bigint
  paid: boolean
}

function harness(opts: {
  entries: Array<{ _id: string, userId: number, weekId: number, score: bigint }>
  pool: bigint
  unsettled?: number[]
  paused?: boolean
  eligible?: (userId: number) => boolean
  transferThrows?: (userId: number) => boolean
}) {
  const state = new Map<string, EntryState>()
  for (const e of opts.entries) {
    state.set(e._id, { _id: e._id, userId: e.userId, weekId: e.weekId, scoreCube: 0n, rank: 0, payoutMicro: 0n, paid: false })
  }
  const scoreByUser = new Map(opts.entries.map(e => [e.userId, e.score]))
  const settled = new Set<number>()
  const calls = {
    transfers: [] as Array<{ userId: number, amountUsdt: number, payoutId: string }>,
    payoutsRecorded: [] as Array<{ weekId: number, userId: number, amount: bigint }>,
    settledWith: [] as Array<{ weekId: number, pool: bigint }>,
  }

  const deps: TournamentSettlementDependencies = {
    currentWeekId: () => 3000,
    findUnsettledTournaments: async () => (opts.unsettled ?? [2999]).filter(w => !settled.has(w)).map(weekId => ({ weekId })),
    findEntries: async weekId => [...state.values()].filter(e => e.weekId === weekId).map(e => ({ _id: e._id, userId: e.userId })),
    scoreForWeek: async (_w, userIds) => new Map(userIds.map(u => [u, scoreByUser.get(u) ?? 0n])),
    payoutEligible: async userId => (opts.eligible ? opts.eligible(userId) : true),
    setEntryResult: async (entryId, r) => {
      const e = state.get(entryId as string)!
      e.scoreCube = r.scoreCube
      e.rank = r.rank
      e.payoutMicro = r.payoutMicro
    },
    markTournamentSettled: async (weekId, pool) => {
      if (settled.has(weekId))
        return false
      settled.add(weekId)
      calls.settledWith.push({ weekId, pool })
      return true
    },
    poolBalance: async () => opts.pool,
    findUnpaidWinners: async (): Promise<SettlementEntry[]> =>
      [...state.values()].filter(e => !e.paid && e.payoutMicro > 0n).map(e => ({ _id: e._id, userId: e.userId, weekId: e.weekId, payoutMicro: e.payoutMicro })),
    claimPayout: async (entryId) => {
      const e = state.get(entryId as string)!
      if (e.paid)
        return false
      e.paid = true
      return true
    },
    recordPayout: async (p) => { calls.payoutsRecorded.push(p) },
    payUser: async (userId, amountUsdt, payoutId) => {
      if (opts.transferThrows?.(userId))
        throw new Error('transfer boom')
      calls.transfers.push({ userId, amountUsdt, payoutId })
    },
    microToUsdt: micro => Number(micro) / 1_000_000,
    areWithdrawalsPaused: async () => opts.paused ?? false,
    logInfo: () => {},
    logError: () => {},
  }
  return { deps, state, calls }
}

test('empty week settles with a zero pool and pays nobody', async () => {
  const { deps, calls } = harness({ entries: [], pool: 5_000_000n })
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  assert.deepEqual(calls.settledWith, [{ weekId: 2999, pool: 0n }])
  assert.equal(calls.transfers.length, 0)
})

test('ranks by score desc and pays winners; payouts sum to the pool', async () => {
  const { deps, state, calls } = harness({
    entries: [
      { _id: 'a', userId: 1, weekId: 2999, score: 100n },
      { _id: 'b', userId: 2, weekId: 2999, score: 300n },
      { _id: 'c', userId: 3, weekId: 2999, score: 200n },
    ],
    pool: 1_000_000n,
  })
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  // user 2 (300) is rank 1, user 3 (200) rank 2, user 1 (100) rank 3
  assert.equal(state.get('b')!.rank, 1)
  assert.equal(state.get('c')!.rank, 2)
  assert.equal(state.get('a')!.rank, 3)
  const totalPaid = calls.transfers.reduce((s, t) => s + t.amountUsdt, 0)
  assert.equal(totalPaid, 1) // 1_000_000 micro = 1 USDT, fully distributed
  assert.equal(calls.payoutsRecorded.reduce((s, p) => s + p.amount, 0n), 1_000_000n)
  // rank 1 gets the largest payout
  const r1 = calls.transfers.find(t => t.userId === 2)!
  assert.ok(r1.amountUsdt >= 0.3)
})

test('a second run pays nobody twice (idempotent)', async () => {
  const { deps, calls } = harness({
    entries: [
      { _id: 'a', userId: 1, weekId: 2999, score: 100n },
      { _id: 'b', userId: 2, weekId: 2999, score: 300n },
    ],
    pool: 1_000_000n,
  })
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  const firstCount = calls.transfers.length
  await runner.runOnce()
  assert.equal(calls.transfers.length, firstCount) // no extra transfers
})

test('withdrawals paused: settles but pays nobody', async () => {
  const { deps, calls } = harness({
    entries: [{ _id: 'a', userId: 1, weekId: 2999, score: 100n }],
    pool: 1_000_000n,
    paused: true,
  })
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  assert.equal(calls.settledWith.length, 1) // settled
  assert.equal(calls.transfers.length, 0) // not paid
})

test('ineligible entrants are ranked but unpaid; pool goes to the eligible field', async () => {
  const { deps, state, calls } = harness({
    entries: [
      { _id: 'a', userId: 1, weekId: 2999, score: 300n }, // ineligible (top scorer)
      { _id: 'b', userId: 2, weekId: 2999, score: 200n },
      { _id: 'c', userId: 3, weekId: 2999, score: 100n },
    ],
    pool: 1_000_000n,
    eligible: userId => userId !== 1,
  })
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  assert.equal(state.get('a')!.rank, 1) // still ranked for display
  assert.equal(state.get('a')!.payoutMicro, 0n) // but unpaid
  assert.equal(calls.transfers.find(t => t.userId === 1), undefined)
  // the full pool went to users 2 and 3
  const totalPaid = calls.transfers.reduce((s, t) => s + Math.round(t.amountUsdt * 1_000_000), 0)
  assert.equal(totalPaid, 1_000_000)
})

test('a failed transfer leaves the entry paid with a recorded debit + logged error', async () => {
  const logs: string[] = []
  const { deps, state, calls } = harness({
    entries: [{ _id: 'a', userId: 1, weekId: 2999, score: 100n }],
    pool: 1_000_000n,
    transferThrows: userId => userId === 1,
  })
  deps.logError = m => logs.push(m)
  const runner = buildTournamentSettlementRunner(deps)
  await runner.runOnce()
  assert.equal(state.get('a')!.paid, true) // claimed, not retried
  assert.equal(calls.payoutsRecorded.length, 1) // pool debit recorded (audit)
  assert.equal(calls.transfers.length, 0) // transfer failed
  assert.ok(logs.some(l => l.includes('payout transfer failed')))
})
