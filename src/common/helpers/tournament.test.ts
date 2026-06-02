/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  currentWeekId,
  isWeekClosed,
  PAYOUT_WEIGHTS_BPS,
  splitPrizePool,
  TOURNAMENT_ENTRY_CUBE,
  WEEK_MS,
  weekEnd,
  weekStart,
} from '#root/common/helpers/tournament'

test('constants have the agreed MVP values', () => {
  assert.equal(TOURNAMENT_ENTRY_CUBE, 2_000)
  assert.equal(WEEK_MS, 604_800_000)
  assert.equal(PAYOUT_WEIGHTS_BPS.reduce((a, b) => a + b, 0), 10_000)
})

test('currentWeekId increments exactly every 7 days', () => {
  const t = new Date('2026-06-03T12:00:00Z')
  const w = currentWeekId(t)
  assert.equal(currentWeekId(new Date(t.getTime() + WEEK_MS)), w + 1)
  assert.equal(currentWeekId(new Date(t.getTime() - WEEK_MS)), w - 1)
})

test('week boundaries land on Monday 00:00 UTC', () => {
  for (const iso of ['2026-06-03T12:00:00Z', '1999-01-01T00:00:00Z', '2030-12-31T23:59:59Z']) {
    const w = currentWeekId(new Date(iso))
    const start = weekStart(w)
    assert.equal(start.getUTCDay(), 1, `${iso}: start is Monday`)
    assert.equal(start.getUTCHours(), 0)
    assert.equal(start.getUTCMinutes(), 0)
    assert.equal(start.getUTCSeconds(), 0)
    assert.equal(weekEnd(w).getTime(), weekStart(w + 1).getTime())
  }
})

test('isWeekClosed is false mid-week, true at/after weekEnd', () => {
  const w = currentWeekId(new Date('2026-06-03T12:00:00Z'))
  assert.equal(isWeekClosed(w, weekStart(w)), false)
  assert.equal(isWeekClosed(w, new Date(weekEnd(w).getTime() - 1)), false)
  assert.equal(isWeekClosed(w, weekEnd(w)), true)
})

test('splitPrizePool returns empty for a non-positive pool or no entrants', () => {
  assert.deepEqual(splitPrizePool(0n, 5), [])
  assert.deepEqual(splitPrizePool(-100n, 5), [])
  assert.deepEqual(splitPrizePool(1000n, 0), [])
})

test('splitPrizePool payouts sum EXACTLY to the pool, descending order', () => {
  for (const pool of [1n, 7n, 1_000_000n, 999_999_999n, 12_345_678_901n]) {
    for (const n of [1, 2, 5, 10, 50]) {
      const payouts = splitPrizePool(pool, n)
      const sum = payouts.reduce((a, b) => a + b, 0n)
      assert.equal(sum, pool, `pool=${pool} n=${n} sums exactly`)
      // descending (rank 1 may carry the remainder, so >=)
      for (let i = 1; i < payouts.length; i++) {
        assert.ok(payouts[i - 1] >= payouts[i], `pool=${pool} n=${n} rank ${i} descends`)
      }
      assert.equal(payouts.length, Math.min(n, PAYOUT_WEIGHTS_BPS.length))
    }
  }
})

test('splitPrizePool distributes 100% even when the field is shorter than the weight table', () => {
  // 3 entrants, 10 weight slots: only top 3 paid, but they share the full pool.
  const payouts = splitPrizePool(1_000_000n, 3)
  assert.equal(payouts.length, 3)
  assert.equal(payouts.reduce((a, b) => a + b, 0n), 1_000_000n)
})
