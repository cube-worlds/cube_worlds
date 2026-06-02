/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addBags,
  canAfford,
  subtractBags,
  UPGRADE_TRACKS,
} from '#root/common/models/Castle'

test('UPGRADE_TRACKS lists the four tracks', () => {
  assert.deepEqual(
    [...UPGRADE_TRACKS].sort(),
    ['forge', 'mine', 'tavern', 'walls'],
  )
})

test('addBags sums two resource bags', () => {
  const r = addBags(
    { gold: 1, iron: 2, mana: 3, food: 4 },
    { gold: 10, iron: 0, mana: 0, food: 1 },
  )
  assert.deepEqual(r, { gold: 11, iron: 2, mana: 3, food: 5 })
})

test('canAfford is true only when every resource covers the cost', () => {
  const have = { gold: 100, iron: 100, mana: 100, food: 100 }
  assert.equal(canAfford(have, { gold: 50, iron: 0, mana: 0, food: 0 }), true)
  assert.equal(canAfford(have, { gold: 200, iron: 0, mana: 0, food: 0 }), false)
})

test('subtractBags returns the exact difference (no flooring at zero)', () => {
  const r = subtractBags(
    { gold: 100, iron: 50, mana: 10, food: 5 },
    { gold: 40, iron: 50, mana: 0, food: 0 },
  )
  assert.deepEqual(r, { gold: 60, iron: 0, mana: 10, food: 5 })
})
