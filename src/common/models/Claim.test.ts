/* eslint-disable test/no-import-node-test */
import type { DocumentType } from '@typegoose/typegoose'
import type { Claim, ClaimMergeCandidate, ClaimPersist, ClaimUpdateFields } from '#root/common/models/Claim'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canClaimNow,
  CLAIM_COOLDOWN_MS,
  claimDaily,
  getClaimStatus,
  hasNeverClaimed,
  planClaimMerge,
  startOfUtcDay,
} from '#root/common/models/Claim'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

interface ClaimFixture extends Pick<
  Claim,
  'streakDays' | 'lastClaimAmount' | 'lastClaimDate' | 'totalClaimed' | 'fractionalCarry'
> {
  persistCalls: Array<{ expectedLastClaimDate: Date, update: ClaimUpdateFields }>
}

function makeClaim(overrides: Partial<ClaimFixture> = {}): ClaimFixture {
  return {
    streakDays: 0,
    lastClaimAmount: 0,
    lastClaimDate: new Date(0),
    totalClaimed: 0,
    fractionalCarry: 0,
    persistCalls: [],
    ...overrides,
  }
}

function asDoc(c: ClaimFixture): DocumentType<Claim> {
  return c as unknown as DocumentType<Claim>
}

// Default test persist: simulates an atomic CAS-success on the in-memory
// fixture. Records the call and reports success.
function makePersist(result: 'won' | 'lost' = 'won'): ClaimPersist {
  return async (claim, expectedLastClaimDate, update) => {
    ;(claim as unknown as ClaimFixture).persistCalls.push({
      expectedLastClaimDate,
      update,
    })
    return result === 'won'
  }
}

// CLAIM_COOLDOWN_MS

test('CLAIM_COOLDOWN_MS exposes the documented 60s cooldown', () => {
  assert.equal(CLAIM_COOLDOWN_MS, 60_000)
})

// canClaimNow

test('canClaimNow returns true when the user has never claimed', () => {
  assert.equal(canClaimNow(asDoc(makeClaim())), true)
})

test('canClaimNow returns false when last claim is inside the cooldown', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({ lastClaimDate: last, streakDays: 1, totalClaimed: 100 })
  // 30s after last claim — still inside the 60s window
  const now = new Date(last.getTime() + 30_000)
  assert.equal(canClaimNow(asDoc(claim), now), false)
})

test('canClaimNow returns true exactly at the cooldown boundary', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({ lastClaimDate: last, streakDays: 1, totalClaimed: 100 })
  const now = new Date(last.getTime() + CLAIM_COOLDOWN_MS)
  assert.equal(canClaimNow(asDoc(claim), now), true)
})

test('canClaimNow returns true after the cooldown has elapsed', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({ lastClaimDate: last, streakDays: 1, totalClaimed: 100 })
  const now = new Date(last.getTime() + 5 * 60_000)
  assert.equal(canClaimNow(asDoc(claim), now), true)
})

// getClaimStatus — never-claimed defaults

test('getClaimStatus reports defaults for a never-claimed user', () => {
  const now = new Date('2025-06-01T12:00:00Z')
  const status = getClaimStatus(asDoc(makeClaim()), now)
  assert.equal(status.hasNeverClaimed, true)
  assert.equal(status.canClaim, true)
  assert.equal(status.streakDays, 0)
  assert.equal(status.claimMultiplier, 1)
  assert.equal(status.secondsUntilClaim, 0)
  assert.equal(status.progressPercent, 100)
  assert.equal(status.totalClaimed, 0)
  assert.deepEqual(status.nextClaimDate, now)
})

test('getClaimStatus pre-credits one cooldown of reward for first claim', () => {
  // BASE_REWARD_PER_MS = 100 / ONE_DAY_MS; cooldown = 60_000 ms
  // expected = 100 * 60_000 / ONE_DAY_MS ≈ 0.069444…
  const status = getClaimStatus(asDoc(makeClaim()), new Date('2025-06-01T00:00:00Z'))
  assert.ok(status.nextClaimAmount > 0.069)
  assert.ok(status.nextClaimAmount < 0.070)
})

// getClaimStatus — mid-cooldown progress

test('getClaimStatus reports progress and seconds remaining mid-cooldown', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 1,
    totalClaimed: 100,
  })
  // 15 seconds in — 25% progress, 45s left
  const status = getClaimStatus(asDoc(claim), new Date(last.getTime() + 15_000))
  assert.equal(status.canClaim, false)
  assert.equal(status.progressPercent, 25)
  assert.equal(status.secondsUntilClaim, 45)
  assert.deepEqual(
    status.nextClaimDate,
    new Date(last.getTime() + CLAIM_COOLDOWN_MS),
  )
})

test('getClaimStatus clamps progress at 100% once past cooldown', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 1,
    totalClaimed: 100,
  })
  const now = new Date(last.getTime() + 90 * 60_000) // 90 min later
  const status = getClaimStatus(asDoc(claim), now)
  assert.equal(status.canClaim, true)
  assert.equal(status.progressPercent, 100)
  assert.equal(status.secondsUntilClaim, 0)
})

// getClaimStatus — multiplier / streak progression

test('getClaimStatus same-UTC-day re-claim keeps streak (clamped 1..10)', () => {
  const last = new Date('2025-06-01T01:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 5,
    totalClaimed: 500,
  })
  const now = new Date('2025-06-01T23:00:00Z')
  const status = getClaimStatus(asDoc(claim), now)
  assert.equal(status.streakDays, 5)
  assert.equal(status.claimMultiplier, 5)
})

test('getClaimStatus next-UTC-day claim bumps streak by one (clamped to 10)', () => {
  const last = new Date('2025-06-01T23:30:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 5,
    totalClaimed: 500,
  })
  const now = new Date('2025-06-02T00:30:00Z')
  const status = getClaimStatus(asDoc(claim), now)
  assert.equal(status.streakDays, 5)
  assert.equal(status.claimMultiplier, 6)
})

test('getClaimStatus caps multiplier at MAX_STREAK_DAYS = 10', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 10,
    totalClaimed: 1000,
  })
  // next day → would be 11 but clamped to 10
  const status = getClaimStatus(asDoc(claim), new Date('2025-06-02T00:00:00Z'))
  assert.equal(status.claimMultiplier, 10)
})

test('getClaimStatus 2+ day gap resets multiplier to 1 and hides streak', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 7,
    totalClaimed: 700,
  })
  const now = new Date('2025-06-04T00:00:00Z')
  const status = getClaimStatus(asDoc(claim), now)
  assert.equal(status.streakDays, 0)
  assert.equal(status.claimMultiplier, 1)
})

test('getClaimStatus floors low streakDays back up to 1', () => {
  // 0 streakDays but other fields non-zero → not "never claimed", so display 1
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 0,
    totalClaimed: 50,
  })
  const status = getClaimStatus(asDoc(claim), new Date('2025-06-01T01:00:00Z'))
  assert.equal(status.streakDays, 1)
  assert.equal(status.claimMultiplier, 1)
})

// reward formulas

test('getClaimStatus rewardPerMinute scales with multiplier', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 5,
    totalClaimed: 500,
  })
  const status = getClaimStatus(asDoc(claim), new Date(last.getTime() + 5_000))
  // 100 / 1440 minutes = 0.069444 base; × 5 = 0.347222
  assert.ok(Math.abs(status.rewardPerMinute - 0.347222) < 0.0005)
})

test('getClaimStatus rewardPerSecond is 1/60 of rewardPerMinute', () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 1,
    totalClaimed: 100,
  })
  const status = getClaimStatus(asDoc(claim), new Date(last.getTime() + 5_000))
  // For a single-day multiplier (which here is 1 since same UTC day), per-sec is per-min/60
  const ratio = status.rewardPerMinute / 60
  assert.ok(Math.abs(status.rewardPerSecond - ratio) < 1e-6)
})

// claimDaily

test('claimDaily throws when claim is not yet available', async () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 1,
    totalClaimed: 100,
  })
  await assert.rejects(
    () => claimDaily(asDoc(claim), new Date(last.getTime() + 30_000), makePersist()),
    /Claim is not available yet/,
  )
  assert.equal(claim.persistCalls.length, 0)
})

test('claimDaily persists, splits integer reward, and carries fractional remainder', async () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 1,
    totalClaimed: 100,
    fractionalCarry: 0.4,
  })
  // exactly 1 day later → multiplier = 2 (next-UTC-day bump)
  const now = new Date(last.getTime() + ONE_DAY_MS)
  const result = await claimDaily(asDoc(claim), now, makePersist())

  // raw = 0.4 + 1day_ms × (100/1day_ms) × 2 = 0.4 + 200 = 200.4
  assert.equal(result.claimedAmount, 200)
  assert.ok(Math.abs(result.rawClaimAmount - 200.4) < 1e-6)
  assert.equal(result.streakDays, 2)
  assert.equal(claim.persistCalls.length, 1)
  assert.equal(claim.persistCalls[0].expectedLastClaimDate, last)
  assert.equal(claim.lastClaimAmount, 200)
  assert.equal(claim.lastClaimDate, now)
  assert.equal(claim.streakDays, 2)
  assert.equal(claim.totalClaimed, 100 + 200)
  assert.ok(Math.abs(claim.fractionalCarry - 0.4) < 1e-6)
})

test('claimDaily on a never-claimed user awards one cooldown worth × multiplier 1', async () => {
  const claim = makeClaim()
  const now = new Date('2025-06-01T00:00:00Z')
  const result = await claimDaily(asDoc(claim), now, makePersist())

  // raw = 0 + 60_000 × (100/ONE_DAY_MS) × 1 ≈ 0.069444
  // Math.floor → 0 claimed, fractional ≈ 0.069444 carried
  assert.equal(result.claimedAmount, 0)
  assert.ok(result.rawClaimAmount > 0.069 && result.rawClaimAmount < 0.070)
  assert.equal(claim.persistCalls.length, 1)
  assert.equal(claim.lastClaimDate, now)
  assert.equal(claim.totalClaimed, 0)
  assert.equal(claim.lastClaimAmount, 0)
  assert.ok(claim.fractionalCarry > 0.069 && claim.fractionalCarry < 0.070)
})

// hasNeverClaimed — branch coverage

test('hasNeverClaimed is true only when every claim field is at its default', () => {
  assert.equal(hasNeverClaimed(asDoc(makeClaim())), true)
})

test('hasNeverClaimed is false when lastClaimDate is set', () => {
  const claim = makeClaim({ lastClaimDate: new Date('2025-06-01T00:00:00Z') })
  assert.equal(hasNeverClaimed(asDoc(claim)), false)
})

test('hasNeverClaimed is false when streakDays is non-zero', () => {
  assert.equal(hasNeverClaimed(asDoc(makeClaim({ streakDays: 1 }))), false)
})

test('hasNeverClaimed is false when totalClaimed is non-zero', () => {
  assert.equal(hasNeverClaimed(asDoc(makeClaim({ totalClaimed: 1 }))), false)
})

test('hasNeverClaimed is false when fractionalCarry is non-zero', () => {
  assert.equal(hasNeverClaimed(asDoc(makeClaim({ fractionalCarry: 0.1 }))), false)
})

// startOfUtcDay

test('startOfUtcDay floors a mid-day timestamp to UTC midnight', () => {
  const result = startOfUtcDay(new Date('2025-06-01T17:42:13.456Z'))
  assert.equal(result.toISOString(), '2025-06-01T00:00:00.000Z')
})

test('startOfUtcDay is idempotent on a value already at UTC midnight', () => {
  const midnight = new Date('2025-06-01T00:00:00.000Z')
  assert.equal(startOfUtcDay(midnight).getTime(), midnight.getTime())
})

test('startOfUtcDay ignores local-timezone offsets — uses UTC components', () => {
  // 23:30 in UTC on Jun 1 stays on Jun 1 even if local zone is +02:00 (Jun 2 local)
  const result = startOfUtcDay(new Date('2025-06-01T23:30:00.000Z'))
  assert.equal(result.toISOString(), '2025-06-01T00:00:00.000Z')
})

test('claimDaily after a long gap resets multiplier to 1', async () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 8,
    totalClaimed: 800,
  })
  // 5 days later — streak broken, multiplier should be 1
  const now = new Date(last.getTime() + 5 * ONE_DAY_MS)
  const result = await claimDaily(asDoc(claim), now, makePersist())

  assert.equal(result.streakDays, 1)
  assert.equal(claim.streakDays, 1)
  // raw = 0 + 5day_ms × (100/1day_ms) × 1 = 500
  assert.equal(result.claimedAmount, 500)
})

// Atomic CAS — distributed-claim safety

test('claimDaily throws and does not mutate when persist reports a lost race', async () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({
    lastClaimDate: last,
    streakDays: 3,
    totalClaimed: 300,
    lastClaimAmount: 100,
    fractionalCarry: 0.25,
  })
  const now = new Date(last.getTime() + ONE_DAY_MS)

  await assert.rejects(
    () => claimDaily(asDoc(claim), now, makePersist('lost')),
    /Claim is not available yet/,
  )
  assert.equal(claim.persistCalls.length, 1)
  // In-memory doc must be untouched when CAS loses, so the caller's
  // subsequent reads (e.g. balance, status) reflect the *real* DB state.
  assert.equal(claim.lastClaimDate, last)
  assert.equal(claim.streakDays, 3)
  assert.equal(claim.totalClaimed, 300)
  assert.equal(claim.lastClaimAmount, 100)
  assert.equal(claim.fractionalCarry, 0.25)
})

test('claimDaily snapshots lastClaimDate before mutating so concurrent calls cannot poison the filter', async () => {
  const last = new Date('2025-06-01T00:00:00Z')
  const claim = makeClaim({ lastClaimDate: last, streakDays: 1, totalClaimed: 100 })
  const now = new Date(last.getTime() + ONE_DAY_MS)

  await claimDaily(asDoc(claim), now, makePersist())
  assert.equal(claim.persistCalls[0].expectedLastClaimDate, last)
  // Mutation only happens after persist confirms — so the filter value
  // was the pre-update timestamp, exactly what Mongo's CAS needs.
  assert.equal(claim.lastClaimDate, now)
})

// planClaimMerge — duplicate-claim migration planner

test('planClaimMerge throws when given no claims', () => {
  assert.throws(() => planClaimMerge([]), /requires at least one claim/)
})

test('planClaimMerge picks the most recent lastClaimDate as survivor', () => {
  const stale: ClaimMergeCandidate = {
    _id: 'orphan',
    streakDays: 0,
    lastClaimAmount: 0,
    lastClaimDate: new Date(0),
    totalClaimed: 0,
    fractionalCarry: 0,
  }
  const active: ClaimMergeCandidate = {
    _id: 'active',
    streakDays: 4,
    lastClaimAmount: 200,
    lastClaimDate: new Date('2026-04-01T00:00:00Z'),
    totalClaimed: 1500,
    fractionalCarry: 0.2,
  }
  const plan = planClaimMerge([stale, active])
  assert.equal(plan.survivorId, 'active')
  assert.deepEqual(plan.removedIds, ['orphan'])
  assert.equal(plan.mergedFields.streakDays, 4)
  assert.equal(plan.mergedFields.lastClaimAmount, 200)
  assert.equal(plan.mergedFields.totalClaimed, 1500)
  assert.equal(plan.mergedFields.fractionalCarry, 0.2)
})

test('planClaimMerge sums totalClaimed across all dupes so credit is preserved', () => {
  const a: ClaimMergeCandidate = {
    _id: 'a',
    streakDays: 2,
    lastClaimAmount: 100,
    lastClaimDate: new Date('2026-04-01T00:00:00Z'),
    totalClaimed: 500,
    fractionalCarry: 0.3,
  }
  const b: ClaimMergeCandidate = {
    _id: 'b',
    streakDays: 3,
    lastClaimAmount: 50,
    lastClaimDate: new Date('2026-03-30T00:00:00Z'),
    totalClaimed: 200,
    fractionalCarry: 0.4,
  }
  const plan = planClaimMerge([a, b])
  assert.equal(plan.survivorId, 'a')
  assert.equal(plan.mergedFields.totalClaimed, 700)
  // streakDays is max across dupes — never lose progress
  assert.equal(plan.mergedFields.streakDays, 3)
  assert.equal(plan.mergedFields.fractionalCarry, 0.7)
})

test('planClaimMerge breaks lastClaimDate ties by highest totalClaimed', () => {
  const same = new Date('2026-04-01T00:00:00Z')
  const small: ClaimMergeCandidate = {
    _id: 'small',
    streakDays: 1,
    lastClaimAmount: 10,
    lastClaimDate: same,
    totalClaimed: 100,
    fractionalCarry: 0,
  }
  const big: ClaimMergeCandidate = {
    _id: 'big',
    streakDays: 1,
    lastClaimAmount: 100,
    lastClaimDate: same,
    totalClaimed: 800,
    fractionalCarry: 0,
  }
  const plan = planClaimMerge([small, big])
  assert.equal(plan.survivorId, 'big')
  assert.deepEqual(plan.removedIds, ['small'])
})

test('planClaimMerge on a singleton returns an empty removal list', () => {
  const only: ClaimMergeCandidate = {
    _id: 'only',
    streakDays: 1,
    lastClaimAmount: 50,
    lastClaimDate: new Date('2026-04-01T00:00:00Z'),
    totalClaimed: 50,
    fractionalCarry: 0.1,
  }
  const plan = planClaimMerge([only])
  assert.equal(plan.survivorId, 'only')
  assert.deepEqual(plan.removedIds, [])
  // Survivor's own fields are preserved unchanged
  assert.equal(plan.mergedFields.totalClaimed, 50)
  assert.equal(plan.mergedFields.streakDays, 1)
})
