/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BASE_PRODUCTION,
  computeProduction,
  FOUNDER_MULTIPLIER,
  MAX_UNCLAIMED_TICKS,
  PRODUCTION_TICK_MS,
} from '#root/common/helpers/production'

test('PRODUCTION_TICK_MS is eight hours', () => {
  assert.equal(PRODUCTION_TICK_MS, 8 * 60 * 60 * 1000)
})

test('no whole tick elapsed yields nothing and preserves the clock', () => {
  const last = new Date(1_000_000)
  const now = new Date(1_000_000 + PRODUCTION_TICK_MS - 1)
  const r = computeProduction({ lastProductionAt: last, mineLevel: 0, isFounder: false }, now)
  assert.deepEqual(r.gained, { gold: 0, iron: 0, mana: 0, food: 0 })
  assert.equal(r.ticks, 0)
  assert.equal(r.nextProductionAt.getTime(), last.getTime())
})

test('one tick at mine 0, non-founder yields base output', () => {
  const last = new Date(0)
  const now = new Date(PRODUCTION_TICK_MS)
  const r = computeProduction({ lastProductionAt: last, mineLevel: 0, isFounder: false }, now)
  assert.deepEqual(r.gained, { ...BASE_PRODUCTION })
  assert.equal(r.ticks, 1)
  assert.equal(r.nextProductionAt.getTime(), PRODUCTION_TICK_MS)
})

test('accrual caps at MAX_UNCLAIMED_TICKS even after a long absence', () => {
  const last = new Date(0)
  const now = new Date(PRODUCTION_TICK_MS * 10)
  const r = computeProduction({ lastProductionAt: last, mineLevel: 0, isFounder: false }, now)
  assert.equal(r.ticks, MAX_UNCLAIMED_TICKS)
  assert.equal(r.gained.gold, BASE_PRODUCTION.gold * MAX_UNCLAIMED_TICKS)
  assert.equal(r.nextProductionAt.getTime(), now.getTime())
})

test('two ticks preserves the partial-tick remainder in the clock', () => {
  const last = new Date(0)
  const now = new Date(2 * PRODUCTION_TICK_MS + 1000) // +1s remainder
  const r = computeProduction({ lastProductionAt: last, mineLevel: 0, isFounder: false }, now)
  assert.equal(r.ticks, 2)
  assert.equal(r.nextProductionAt.getTime(), 2 * PRODUCTION_TICK_MS)
})

test('founder perk adds 20%, mine level scales 25% per level (floored)', () => {
  const last = new Date(0)
  const now = new Date(PRODUCTION_TICK_MS)
  const r = computeProduction({ lastProductionAt: last, mineLevel: 2, isFounder: true }, now)
  assert.equal(FOUNDER_MULTIPLIER, 1.2)
  assert.equal(r.gained.gold, Math.floor(BASE_PRODUCTION.gold * 1.5 * 1.2))
})

test('negative elapsed (clock skew) yields nothing and preserves the clock', () => {
  const r = computeProduction({ lastProductionAt: new Date(10_000), mineLevel: 0, isFounder: false }, new Date(0))
  assert.deepEqual(r.gained, { gold: 0, iron: 0, mana: 0, food: 0 })
  assert.equal(r.ticks, 0)
  assert.equal(r.nextProductionAt.getTime(), 10_000)
})

test('negative mineLevel is clamped to level 0', () => {
  const r = computeProduction({ lastProductionAt: new Date(0), mineLevel: -5, isFounder: false }, new Date(PRODUCTION_TICK_MS))
  assert.deepEqual(r.gained, { ...BASE_PRODUCTION })
})

test('exactly MAX_UNCLAIMED_TICKS whole ticks advances the clock to now (no jump ambiguity)', () => {
  const now = new Date(MAX_UNCLAIMED_TICKS * PRODUCTION_TICK_MS)
  const r = computeProduction({ lastProductionAt: new Date(0), mineLevel: 0, isFounder: false }, now)
  assert.equal(r.ticks, MAX_UNCLAIMED_TICKS)
  assert.equal(r.nextProductionAt.getTime(), MAX_UNCLAIMED_TICKS * PRODUCTION_TICK_MS)
})

test('beyond MAX_UNCLAIMED_TICKS forfeits the overflow and jumps the clock to now', () => {
  // whole = MAX_UNCLAIMED_TICKS + 1 triggers the cap-jump (whole > MAX_UNCLAIMED_TICKS)
  const now = new Date((MAX_UNCLAIMED_TICKS + 1) * PRODUCTION_TICK_MS + 5000)
  const r = computeProduction({ lastProductionAt: new Date(0), mineLevel: 0, isFounder: false }, now)
  assert.equal(r.ticks, MAX_UNCLAIMED_TICKS)
  assert.equal(r.nextProductionAt.getTime(), now.getTime())
})
