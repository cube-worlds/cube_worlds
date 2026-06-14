/* eslint-disable test/no-import-node-test */
import type { MintFloorParams } from '#root/common/helpers/mint-floor'
import assert from 'node:assert/strict'
import test from 'node:test'
import { isMintEligible, mintFloorVotes } from '#root/common/helpers/mint-floor'

// Defaults mirror config: base=0, step=500, cap=100000.
const PARAMS: MintFloorParams = { base: 0n, step: 500n, cap: 100_000n }

// 1. EXACT VALUES

test('mintFloorVotes returns exact values for n=0,1,10', () => {
  assert.equal(mintFloorVotes(0, PARAMS), 0n)
  assert.equal(mintFloorVotes(1, PARAMS), 500n)
  assert.equal(mintFloorVotes(10, PARAMS), 5_000n)
})

test('mintFloorVotes honours a non-zero base', () => {
  const p: MintFloorParams = { base: 1_000n, step: 500n, cap: 100_000n }
  assert.equal(mintFloorVotes(0, p), 1_000n)
  assert.equal(mintFloorVotes(2, p), 2_000n)
})

// 2. CAP

test('mintFloorVotes never exceeds cap for huge n', () => {
  assert.equal(mintFloorVotes(1_000_000, PARAMS), 100_000n)
  assert.equal(mintFloorVotes(Number.MAX_SAFE_INTEGER, PARAMS), 100_000n)
})

test('mintFloorVotes clamps to cap even when base alone exceeds it', () => {
  const p: MintFloorParams = { base: 999_999n, step: 500n, cap: 100_000n }
  assert.equal(mintFloorVotes(0, p), 100_000n)
  assert.equal(mintFloorVotes(5, p), 100_000n)
})

// 3. MONOTONICITY (non-decreasing in n)

test('mintFloorVotes is strictly non-decreasing in mintedCount', () => {
  let prev = mintFloorVotes(0, PARAMS)
  for (let n = 1; n <= 500; n++) {
    const cur = mintFloorVotes(n, PARAMS)
    assert.ok(cur >= prev, `floor(${n})=${cur} should be >= floor(${n - 1})=${prev}`)
    prev = cur
  }
})

// 4. EDGE: negative / fractional counts floor to a safe non-negative integer

test('mintFloorVotes treats negative mintedCount as 0', () => {
  assert.equal(mintFloorVotes(-5, PARAMS), 0n)
})

test('mintFloorVotes floors a fractional mintedCount', () => {
  assert.equal(mintFloorVotes(2.9, PARAMS), 1_000n)
})

// 5. isMintEligible boundary

test('isMintEligible is false just below the floor and true at/above', () => {
  // floor(1) = 500
  assert.equal(isMintEligible(499n, 1, PARAMS), false, 'below floor')
  assert.equal(isMintEligible(500n, 1, PARAMS), true, 'exactly at floor')
  assert.equal(isMintEligible(501n, 1, PARAMS), true, 'above floor')
})

test('isMintEligible at n=0 admits any non-negative votes (floor 0)', () => {
  assert.equal(isMintEligible(0n, 0, PARAMS), true)
})
