/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cnftHexColor,
  CNFTImageType,
  pickCNFTType,
  pickNextColor,
} from '#root/common/models/CNFT'

// pickCNFTType — diceWinner takes precedence over everything else

test('pickCNFTType: diceWinner wins regardless of votes/referrals', () => {
  assert.equal(pickCNFTType(0n, 0, true), CNFTImageType.Dice)
  assert.equal(pickCNFTType(2_000_000n, 100, true), CNFTImageType.Dice)
})

// pickCNFTType — vote tiers (using strict greater-than)

test('pickCNFTType: votes above 1_000_000 → Whale', () => {
  assert.equal(pickCNFTType(1_000_001n, 0, false), CNFTImageType.Whale)
  assert.equal(pickCNFTType(10_000_000n, 0, false), CNFTImageType.Whale)
})

test('pickCNFTType: votes exactly 1_000_000 → Diamond (strict >)', () => {
  assert.equal(pickCNFTType(1_000_000n, 0, false), CNFTImageType.Diamond)
})

test('pickCNFTType: votes between 500_001 and 1_000_000 → Diamond', () => {
  assert.equal(pickCNFTType(500_001n, 0, false), CNFTImageType.Diamond)
  assert.equal(pickCNFTType(750_000n, 0, false), CNFTImageType.Diamond)
})

test('pickCNFTType: votes exactly 500_000 → Coin (strict >)', () => {
  assert.equal(pickCNFTType(500_000n, 0, false), CNFTImageType.Coin)
})

test('pickCNFTType: votes between 100_001 and 500_000 → Coin', () => {
  assert.equal(pickCNFTType(100_001n, 0, false), CNFTImageType.Coin)
  assert.equal(pickCNFTType(250_000n, 0, false), CNFTImageType.Coin)
})

test('pickCNFTType: votes exactly 100_000 → falls through to referrals/Common', () => {
  assert.equal(pickCNFTType(100_000n, 0, false), CNFTImageType.Common)
  assert.equal(pickCNFTType(100_000n, 1, false), CNFTImageType.Knight)
})

// pickCNFTType — Knight via referrals

test('pickCNFTType: referrals > 0 with low votes → Knight', () => {
  assert.equal(pickCNFTType(0n, 1, false), CNFTImageType.Knight)
  assert.equal(pickCNFTType(50_000n, 5, false), CNFTImageType.Knight)
})

test('pickCNFTType: high votes outrank Knight', () => {
  // Whale vote tier wins over referrals
  assert.equal(pickCNFTType(2_000_000n, 100, false), CNFTImageType.Whale)
  assert.equal(pickCNFTType(600_000n, 100, false), CNFTImageType.Diamond)
  assert.equal(pickCNFTType(150_000n, 100, false), CNFTImageType.Coin)
})

// pickCNFTType — Common fall-through

test('pickCNFTType: zero everything → Common', () => {
  assert.equal(pickCNFTType(0n, 0, false), CNFTImageType.Common)
})

test('pickCNFTType: low votes and zero referrals → Common', () => {
  assert.equal(pickCNFTType(99_999n, 0, false), CNFTImageType.Common)
})

test('pickCNFTType: negative referrals do not promote to Knight', () => {
  assert.equal(pickCNFTType(0n, -1, false), CNFTImageType.Common)
})

// pickNextColor — rotation modulo palette length (11 colors)

test('pickNextColor: undefined latest → first color (0)', () => {
  assert.equal(pickNextColor(undefined), 0)
})

test('pickNextColor: increments and wraps at the palette length', () => {
  // palette has 11 colors (indices 0–10)
  for (let i = 0; i < 10; i++) {
    assert.equal(pickNextColor(i), i + 1)
  }
  // wraparound: latest=10 → next is (10+1) % 11 = 0
  assert.equal(pickNextColor(10), 0)
})

test('pickNextColor: -1 sentinel rolls to 0 (matches addCNFT default)', () => {
  assert.equal(pickNextColor(-1), 0)
})

test('pickNextColor: matches cnftHexColor input convention', () => {
  // Round-trip: pick a next color, look up its hex — should always succeed
  for (let latest = -1; latest < 12; latest++) {
    const next = pickNextColor(latest)
    const hex = cnftHexColor(next)
    assert.match(hex, /^#[0-9A-F]{6}$/)
  }
})
