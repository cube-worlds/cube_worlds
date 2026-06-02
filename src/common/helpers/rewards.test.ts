/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { accrueShare, REWARDS_POOL_BPS } from '#root/common/helpers/rewards'

test('REWARDS_POOL_BPS is the 20% invariant', () => {
  assert.equal(REWARDS_POOL_BPS, 2000n)
})

test('accrueShare takes 20% of common amounts', () => {
  assert.equal(accrueShare(1_000_000n), 200_000n) // 0.2 USDT of 1 USDT
  assert.equal(accrueShare(500_000n), 100_000n)
  assert.equal(accrueShare(3_000n), 600n)
})

test('accrueShare floors and returns 0 for non-positive', () => {
  assert.equal(accrueShare(0n), 0n)
  assert.equal(accrueShare(-100n), 0n)
  // 7 micro * 2000 / 10000 = 1.4 -> floor 1
  assert.equal(accrueShare(7n), 1n)
})

test('accrueShare honors a custom bps', () => {
  assert.equal(accrueShare(1_000_000n, 1000n), 100_000n) // 10%
})
