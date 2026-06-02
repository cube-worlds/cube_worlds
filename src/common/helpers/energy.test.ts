/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AD_DAILY_CAP,
  AD_ENERGY_REWARD,
  ENERGY_MAX,
  ENERGY_PACK_AMOUNT,
  ENERGY_PACK_PRICE_USDT,
  ENERGY_REGEN_INTERVAL_MS,
  EXPEDITION_ENERGY_COST,
  REFILL_CUBE_COST,
  REFILL_ENERGY_AMOUNT,
  regenEnergy,
  SEASON_PASS_BONUS_ENTRIES,
  SEASON_PASS_ENERGY_CAP,
} from '#root/common/helpers/energy'

test('constants have the agreed MVP values', () => {
  assert.equal(ENERGY_MAX, 120)
  assert.equal(EXPEDITION_ENERGY_COST, 30)
  // +10 energy/hour => one point every 6 minutes
  assert.equal(ENERGY_REGEN_INTERVAL_MS, 360_000)
  assert.equal(REFILL_CUBE_COST, 500)
  assert.equal(REFILL_ENERGY_AMOUNT, 30)
})

test('energy-pack constants have the agreed MVP values', () => {
  assert.equal(ENERGY_PACK_AMOUNT, 120)
  assert.equal(ENERGY_PACK_PRICE_USDT, 0.5)
})

test('regenEnergy adds whole points for elapsed intervals, capped at max', () => {
  const last = new Date(0)
  // 0 elapsed -> unchanged
  assert.deepEqual(regenEnergy(50, last, new Date(0)), { current: 50, regenAt: last })
  // 3 intervals elapsed (18 min) -> +3
  const after18 = regenEnergy(50, last, new Date(18 * 60 * 1000))
  assert.equal(after18.current, 53)
  assert.equal(after18.regenAt.getTime(), 18 * 60 * 1000)
  // partial interval does not advance regenAt past the consumed whole intervals
  const after20 = regenEnergy(50, last, new Date(20 * 60 * 1000))
  assert.equal(after20.current, 53) // still 3 whole intervals
  assert.equal(after20.regenAt.getTime(), 18 * 60 * 1000) // 2 min remainder carried
})

test('regenEnergy never exceeds ENERGY_MAX and freezes regenAt at the cap', () => {
  const result = regenEnergy(119, new Date(0), new Date(10 * 60 * 60 * 1000))
  assert.equal(result.current, ENERGY_MAX)
  // once capped, regenAt jumps to now so no "banked" overflow is granted later
  assert.equal(result.regenAt.getTime(), 10 * 60 * 60 * 1000)
})

test('regenEnergy leaves an already-capped balance untouched', () => {
  const now = new Date(5_000_000)
  const result = regenEnergy(ENERGY_MAX, new Date(0), now)
  assert.equal(result.current, ENERGY_MAX)
  assert.equal(result.regenAt.getTime(), now.getTime())
})

test('ad-reward + season-pass constants have the agreed MVP values', () => {
  assert.equal(AD_ENERGY_REWARD, 20)
  assert.equal(AD_DAILY_CAP, 5)
  assert.equal(SEASON_PASS_ENERGY_CAP, 240)
  assert.equal(SEASON_PASS_BONUS_ENTRIES, 1)
})

test('regenEnergy regenerates past ENERGY_MAX when given a higher cap', () => {
  // A season-pass holder (cap 240) keeps regenerating beyond the base 120.
  const result = regenEnergy(150, new Date(0), new Date(60 * 60 * 1000), SEASON_PASS_ENERGY_CAP)
  assert.equal(result.current, 160) // +10 in one hour
  // ...but still freezes at the elevated cap, not above it.
  const capped = regenEnergy(235, new Date(0), new Date(10 * 60 * 60 * 1000), SEASON_PASS_ENERGY_CAP)
  assert.equal(capped.current, SEASON_PASS_ENERGY_CAP)
})

test('regenEnergy default cap still clamps at ENERGY_MAX', () => {
  const result = regenEnergy(119, new Date(0), new Date(10 * 60 * 60 * 1000))
  assert.equal(result.current, ENERGY_MAX)
})
