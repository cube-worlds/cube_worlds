/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDateTimeCompact, sleep, timeUnitsBetween } from '#root/common/helpers/time'

test('timeUnitsBetween returns zeros for identical dates', () => {
  const d = new Date('2025-01-01T00:00:00Z')
  const result = timeUnitsBetween(d, d)
  assert.deepEqual(result, { days: 0, hours: 0, minutes: 0, seconds: 0 })
})

test('timeUnitsBetween splits a delta across all four units (forward)', () => {
  const start = new Date('2025-01-01T00:00:00Z')
  // 2 days 3 hours 4 minutes 5 seconds later
  const ms = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
  const end = new Date(start.getTime() + ms)
  const result = timeUnitsBetween(start, end)
  assert.deepEqual(result, { days: 2, hours: 3, minutes: 4, seconds: 5 })
})

test('timeUnitsBetween returns negative units when start is after end', () => {
  const end = new Date('2025-01-01T00:00:00Z')
  // 1 day 2 hours 3 minutes 4 seconds later
  const ms = (1 * 86400 + 2 * 3600 + 3 * 60 + 4) * 1000
  const start = new Date(end.getTime() + ms)
  const result = timeUnitsBetween(start, end)
  assert.deepEqual(result, { days: -1, hours: -2, minutes: -3, seconds: -4 })
})

test('formatDateTimeCompact strips century from date and milliseconds from time', () => {
  const d = new Date('2025-03-04T05:06:07.123Z')
  assert.equal(formatDateTimeCompact(d), '25-03-04 05:06:07')
})

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now()
  await sleep(20)
  const elapsed = Date.now() - start
  // 20ms is the floor, but timer drift can make it ~15-50ms in CI
  assert.ok(elapsed >= 15, `expected at least 15ms, got ${elapsed}`)
})
