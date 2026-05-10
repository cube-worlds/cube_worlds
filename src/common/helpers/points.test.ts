/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tonToPoints } from '#root/common/helpers/points'

// halvingStart in points.ts is May 15, 2024 (month index 4)

test('before halving start: full 100_000 rate', () => {
  // 2024-05-14: currentDate <= halvingStart → 0 halvings
  const points = tonToPoints(1, new Date(2024, 4, 14))
  assert.equal(points, 100_000n)
})

test('at halving start exactly: still 0 halvings (strict >)', () => {
  // The implementation uses `if (currentDate > halvingStart)` — equal does not count
  const points = tonToPoints(1, new Date(2024, 4, 15))
  assert.equal(points, 100_000n)
})

test('day after halving start: still no anniversary passed', () => {
  // currentDate > halvingStart, but yearsPassed = 0 so loop does not run
  const points = tonToPoints(1, new Date(2024, 4, 16))
  assert.equal(points, 100_000n)
})

test('day before first anniversary (2025-05-14): no halvings yet', () => {
  // yearsPassed = 1, but 2025-05-14 < 2025-05-15 anniversary → not counted
  const points = tonToPoints(1, new Date(2025, 4, 14))
  assert.equal(points, 100_000n)
})

test('first anniversary (2025-05-15): one halving → rate 50_000', () => {
  const points = tonToPoints(1, new Date(2025, 4, 15))
  assert.equal(points, 50_000n)
})

test('second anniversary (2026-05-15): two halvings → rate 25_000', () => {
  const points = tonToPoints(1, new Date(2026, 4, 15))
  assert.equal(points, 25_000n)
})

test('third anniversary (2027-05-15): three halvings → rate 12_500', () => {
  const points = tonToPoints(1, new Date(2027, 4, 15))
  assert.equal(points, 12_500n)
})

test('rate floors at 1 after many halvings', () => {
  // 17 halvings would push 100_000 >> 17 to 0; max(rate, 1) keeps it at 1
  // 2024 + 20 = 2044 anniversary date passed
  const points = tonToPoints(1, new Date(2044, 4, 15))
  assert.equal(points, 1n)
})

test('points floor at 1n when rounding would yield 0', () => {
  // 0.000001 TON × 1 rate = 0.000001 → rounds to 0 → clamped to 1n
  const points = tonToPoints(0.000001, new Date(2044, 4, 15))
  assert.equal(points, 1n)
})

test('fractional TON multiplies into the rate', () => {
  // 0.5 TON × 50_000 = 25_000
  const points = tonToPoints(0.5, new Date(2025, 4, 15))
  assert.equal(points, 25_000n)
})

test('large TON values produce proportionally large bigint', () => {
  // 1000 TON × 100_000 = 100_000_000
  const points = tonToPoints(1000, new Date(2024, 4, 14))
  assert.equal(points, 100_000_000n)
})

test('rounding: 1.5 TON at rate 1 → 2n (Math.round half-away-from-zero in JS rounds .5 up)', () => {
  // Force rate=1 by going far into the future, then verify rounding behavior
  const points = tonToPoints(1.5, new Date(2044, 4, 15))
  assert.equal(points, 2n)
})

test('default now (no argument) uses current Date — sanity check, no exception', () => {
  const points = tonToPoints(1)
  assert.ok(typeof points === 'bigint')
  assert.ok(points >= 1n)
})
