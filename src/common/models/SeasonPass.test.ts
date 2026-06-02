/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { extendActiveUntil, SEASON_PASS_PERIOD_MS } from '#root/common/models/SeasonPass'

test('extendActiveUntil adds one period from now for a first-time / lapsed pass', () => {
  const now = new Date('2026-06-03T00:00:00Z')
  assert.equal(
    extendActiveUntil(now, undefined).getTime(),
    now.getTime() + SEASON_PASS_PERIOD_MS,
  )
  // An expired pass also extends from now, not from the stale expiry.
  const expired = new Date('2026-05-01T00:00:00Z')
  assert.equal(
    extendActiveUntil(now, expired).getTime(),
    now.getTime() + SEASON_PASS_PERIOD_MS,
  )
})

test('extendActiveUntil stacks on an unexpired pass (early renewal)', () => {
  const now = new Date('2026-06-03T00:00:00Z')
  const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days left
  assert.equal(
    extendActiveUntil(now, future).getTime(),
    future.getTime() + SEASON_PASS_PERIOD_MS,
  )
})
