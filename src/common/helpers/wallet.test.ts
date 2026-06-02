/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MICRO_PER_USDT,
  microToUsdt,
  usdtToMicro,
  validateUsdtAmount,
  WALLET_CURRENCY,
  WalletEntryType,
} from '#root/common/helpers/wallet'

test('currency + scale constants', () => {
  assert.equal(WALLET_CURRENCY, 'USDT')
  assert.equal(MICRO_PER_USDT, 1_000_000n)
})

test('usdtToMicro converts a positive number to bigint micro-units', () => {
  assert.equal(usdtToMicro(1), 1_000_000n)
  assert.equal(usdtToMicro(0.5), 500_000n)
  assert.equal(usdtToMicro(1.234567), 1_234_567n)
})

test('usdtToMicro rounds to the nearest micro-unit (no float dust)', () => {
  // 0.1 is not exactly representable in float; rounding keeps it clean
  assert.equal(usdtToMicro(0.1), 100_000n)
  assert.equal(usdtToMicro(2.9999999), 3_000_000n)
})

test('microToUsdt is the inverse for display', () => {
  assert.equal(microToUsdt(1_000_000n), 1)
  assert.equal(microToUsdt(500_000n), 0.5)
  assert.equal(microToUsdt(1_234_567n), 1.234567)
})

test('validateUsdtAmount accepts positive finite amounts within bounds', () => {
  assert.equal(validateUsdtAmount(1.5), 1_500_000n)
})

test('validateUsdtAmount rejects non-positive, non-finite, or oversized amounts', () => {
  assert.throws(() => validateUsdtAmount(0))
  assert.throws(() => validateUsdtAmount(-1))
  assert.throws(() => validateUsdtAmount(Number.NaN))
  assert.throws(() => validateUsdtAmount(Number.POSITIVE_INFINITY))
  assert.throws(() => validateUsdtAmount(1_000_001)) // > MAX_USDT_AMOUNT
})

test('WalletEntryType has the money-rail entries', () => {
  assert.equal(WalletEntryType.Deposit, 'deposit')
  assert.equal(WalletEntryType.Withdraw, 'withdraw')
  assert.equal(WalletEntryType.Transfer, 'transfer')
  assert.equal(WalletEntryType.BuyEnergy, 'buy_energy')
})
