/* eslint-disable test/no-import-node-test */
import type { MintFloorParams } from '#root/common/helpers/mint-floor'
import type { UserDoc, UserOperationsDependencies } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BalanceChangeType } from '#root/common/models/Balance'
import { buildUserOperations } from '#root/common/models/User'

const FLOOR_PARAMS: MintFloorParams = { base: 0n, step: 500n, cap: 100_000n }

function noopDeps(): UserOperationsDependencies {
  return {
    countLineWhereVotesGte: async () => 0,
    countWhalesWhereVotesGte: async () => 0,
    incrementUserVotes: async () => ({ votes: 0n }),
    addChangeBalanceRecord: async (_u, amount) => ({ amount }),
    getAggregatedBalance: async () => 0n,
    countAllUsers: async () => 0,
    countMintedUsers: async () => 0,
    countLineUsers: async () => 0,
    countUsersUpdatedSince: async () => 0,
    countAllMinted: async () => 0,
    findEligibleSubmissions: async () => [],
    now: () => 0,
    infoLog: () => {},
    debugLog: () => {},
    errorLog: () => {},
  }
}

// placeInLine — zero-count → undefined

test('placeInLine returns undefined when nobody at-or-above the votes', async () => {
  const lineGteCalls: bigint[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    countLineWhereVotesGte: async (votes) => {
      lineGteCalls.push(votes)
      return 0
    },
  })

  assert.equal(await ops.placeInLine(100n), undefined)
  assert.deepEqual(lineGteCalls, [100n])
})

test('placeInLine returns the raw count when ≥1 user is at-or-above the votes', async () => {
  const ops = buildUserOperations({
    ...noopDeps(),
    countLineWhereVotesGte: async () => 3,
  })
  assert.equal(await ops.placeInLine(50n), 3)
})

// placeInWhales — zero-count → undefined

test('placeInWhales returns undefined when nobody at-or-above the votes', async () => {
  const whalesGteCalls: bigint[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    countWhalesWhereVotesGte: async (votes) => {
      whalesGteCalls.push(votes)
      return 0
    },
  })

  assert.equal(await ops.placeInWhales(1_000_000n), undefined)
  assert.deepEqual(whalesGteCalls, [1_000_000n])
})

test('placeInWhales returns the count when ≥1 whale qualifies', async () => {
  const ops = buildUserOperations({
    ...noopDeps(),
    countWhalesWhereVotesGte: async () => 7,
  })
  assert.equal(await ops.placeInWhales(500_000n), 7)
})

// addPoints — happy path

test('addPoints increments votes, records balance change, and returns new total', async () => {
  const incrementCalls: { userId: number, add: bigint }[] = []
  const balanceCalls: { userId: number, amount: bigint, reason: BalanceChangeType }[] = []
  const aggregatedBalanceCalls: number[] = []
  const infoLogs: string[] = []
  const debugLogs: string[] = []
  const errorLogs: string[] = []

  const ops = buildUserOperations({
    ...noopDeps(),
    incrementUserVotes: async (userId, add) => {
      incrementCalls.push({ userId, add })
      return { votes: 150n }
    },
    addChangeBalanceRecord: async (userId, amount, reason) => {
      balanceCalls.push({ userId, amount, reason })
      return { amount }
    },
    getAggregatedBalance: async (userId) => {
      aggregatedBalanceCalls.push(userId)
      return 999n
    },
    infoLog: (m) => { infoLogs.push(m) },
    debugLog: (m) => { debugLogs.push(m) },
    errorLog: (m) => { errorLogs.push(m) },
  })

  const result = await ops.addPoints(42, 50n, BalanceChangeType.Dice)

  assert.equal(result, 150n)
  assert.deepEqual(incrementCalls, [{ userId: 42, add: 50n }])
  assert.deepEqual(balanceCalls, [
    { userId: 42, amount: 50n, reason: BalanceChangeType.Dice },
  ])
  assert.deepEqual(aggregatedBalanceCalls, [42])
  assert.equal(infoLogs.length, 1)
  assert.match(infoLogs[0], /Add 50 points to 42\. Now 150/)
  assert.equal(debugLogs.length, 1)
  assert.match(debugLogs[0], /Add 50 points to user 42\. Now 999/)
  assert.equal(errorLogs.length, 0)
})

// addPoints — error path: user not found

test('addPoints logs error and rethrows when user is not found', async () => {
  const balanceCalls: unknown[] = []
  const errorLogs: string[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    incrementUserVotes: async () => null,
    addChangeBalanceRecord: async (...args) => {
      balanceCalls.push(args)
      return { amount: 0n }
    },
    errorLog: (m) => { errorLogs.push(m) },
  })

  await assert.rejects(
    () => ops.addPoints(99, 10n, BalanceChangeType.Claim),
    /User for addPoints not found/,
  )
  assert.equal(errorLogs.length, 1)
  assert.match(errorLogs[0], /Can't add points 10 to user 99/)
  assert.equal(balanceCalls.length, 0)
})

// addPoints — error path: addChangeBalanceRecord throws, revert succeeds

test('addPoints reverts the vote increment when the balance-record write fails', async () => {
  const incrementCalls: { userId: number, add: bigint }[] = []
  const errorLogs: string[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    incrementUserVotes: async (userId, add) => {
      incrementCalls.push({ userId, add })
      return { votes: 100n }
    },
    addChangeBalanceRecord: async () => {
      throw new Error('db down')
    },
    errorLog: (m) => { errorLogs.push(m) },
  })

  await assert.rejects(
    () => ops.addPoints(7, 5n, BalanceChangeType.Referral),
    /db down/,
  )
  // Forward increment then compensating decrement — Balance ledger and
  // votes cache stay aligned after the audit-log write fails.
  assert.deepEqual(incrementCalls, [
    { userId: 7, add: 5n },
    { userId: 7, add: -5n },
  ])
  assert.equal(errorLogs.length, 2)
  assert.match(errorLogs[0], /reverted \+5 for 7 after audit write failed/)
  assert.match(errorLogs[1], /Can't add points 5 to user 7/)
})

// addPoints — error path: balance-record write AND revert both fail

test('addPoints logs unrecoverable drift when balance write AND revert fail', async () => {
  let incrementCallCount = 0
  const errorLogs: string[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    incrementUserVotes: async () => {
      incrementCallCount += 1
      if (incrementCallCount === 1) {
        return { votes: 100n }
      }
      throw new Error('revert failed')
    },
    addChangeBalanceRecord: async () => {
      throw new Error('db down')
    },
    errorLog: (m) => { errorLogs.push(m) },
  })

  await assert.rejects(
    () => ops.addPoints(7, 5n, BalanceChangeType.Referral),
    /db down/,
  )
  assert.equal(incrementCallCount, 2)
  assert.equal(errorLogs.length, 2)
  assert.match(errorLogs[0], /unrecoverable drift for 7/)
  assert.match(errorLogs[1], /Can't add points 5 to user 7/)
})

// eligibleQueue — floor-aware filtering + ranking

test('eligibleQueue computes the floor from the minted count and queries with it', async () => {
  const floorQueries: bigint[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    // 10 minted → floor = 0 + 500*10 = 5000
    countAllMinted: async () => 10,
    findEligibleSubmissions: async (floor) => {
      floorQueries.push(floor)
      return [] as unknown as UserDoc[]
    },
  })

  await ops.eligibleQueue(FLOOR_PARAMS)

  assert.deepEqual(floorQueries, [5_000n], 'queries with floor(10)=5000')
})

test('eligibleQueue forwards the votes-desc-ranked submissions verbatim', async () => {
  // The DB query is the source of truth for filter (votes >= floor) + sort
  // (votes desc); the op just threads the computed floor into it.
  const ranked = [
    { id: 1, votes: 9_000n },
    { id: 2, votes: 6_000n },
  ] as unknown as UserDoc[]
  const ops = buildUserOperations({
    ...noopDeps(),
    countAllMinted: async () => 1, // floor(1) = 500
    findEligibleSubmissions: async (floor) => {
      assert.equal(floor, 500n)
      return ranked
    },
  })

  const result = await ops.eligibleQueue(FLOOR_PARAMS)
  assert.deepEqual(result, ranked)
})

test('eligibleQueue caps the floor at the configured cap for large minted counts', async () => {
  const floorQueries: bigint[] = []
  const ops = buildUserOperations({
    ...noopDeps(),
    countAllMinted: async () => 10_000, // 500*10000 = 5,000,000 → capped
    findEligibleSubmissions: async (floor) => {
      floorQueries.push(floor)
      return [] as unknown as UserDoc[]
    },
  })

  await ops.eligibleQueue(FLOOR_PARAMS)
  assert.deepEqual(floorQueries, [100_000n], 'floor clamped to cap')
})

// userStats — date-window math

test('userStats computes month/week/day cutoffs as Date objects relative to now()', async () => {
  const nowMs = Date.parse('2025-06-15T12:00:00.000Z')
  const dayMs = 24 * 60 * 60 * 1000
  const returnQueue = [300, 100, 20] // month, week, day
  const updatedSinceCalls: Date[] = []

  const ops = buildUserOperations({
    ...noopDeps(),
    countAllUsers: async () => 1000,
    countMintedUsers: async () => 200,
    countLineUsers: async () => 50,
    countUsersUpdatedSince: async (since) => {
      updatedSinceCalls.push(since)
      return returnQueue.shift() ?? 0
    },
    now: () => nowMs,
  })

  const stats = await ops.userStats()

  assert.deepEqual(stats, {
    all: 1000,
    minted: 200,
    notMinted: 50,
    month: 300,
    week: 100,
    day: 20,
  })

  assert.equal(updatedSinceCalls.length, 3)
  assert.equal(updatedSinceCalls[0].getTime(), nowMs - 30 * dayMs)
  assert.equal(updatedSinceCalls[1].getTime(), nowMs - 7 * dayMs)
  assert.equal(updatedSinceCalls[2].getTime(), nowMs - 1 * dayMs)
})

test('userStats forwards totals from the dependency callbacks verbatim', async () => {
  const ops = buildUserOperations({
    ...noopDeps(),
    countAllUsers: async () => 7,
    countMintedUsers: async () => 3,
    countLineUsers: async () => 4,
    countUsersUpdatedSince: async () => 1,
    now: () => Date.parse('2025-01-01T00:00:00Z'),
  })

  const stats = await ops.userStats()
  assert.equal(stats.all, 7)
  assert.equal(stats.minted, 3)
  assert.equal(stats.notMinted, 4)
  assert.equal(stats.month, 1)
  assert.equal(stats.week, 1)
  assert.equal(stats.day, 1)
})
