/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyWithdrawFee,
  canWithdraw,
  WITHDRAW_COOLDOWN_MS,
  WITHDRAW_FEE_BPS,
} from '#root/common/helpers/cube-bridge'

test('cooldown blocks a withdraw within 24h of the last one', () => {
  const last = new Date(0)
  assert.equal(canWithdraw(last, new Date(WITHDRAW_COOLDOWN_MS - 1)).ok, false)
  assert.equal(canWithdraw(last, new Date(WITHDRAW_COOLDOWN_MS)).ok, true)
})

test('a never-withdrawn user (null last) can withdraw', () => {
  assert.equal(canWithdraw(null, new Date(0)).ok, true)
})

test('fee is taken in basis points, floored, and never negative', () => {
  const r = applyWithdrawFee(1000n)
  assert.equal(WITHDRAW_FEE_BPS, 200)
  assert.equal(r.fee, 20n)
  assert.equal(r.net, 980n)
})

test('fee math throws on a non-positive amount', () => {
  assert.throws(() => applyWithdrawFee(0n))
  assert.throws(() => applyWithdrawFee(-5n))
})
