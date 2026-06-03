/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyXp,
  BASE_STATS,
  HERO_CLASSES,
  levelFromXp,
  MAX_HERO_LEVEL,
  recruitCost,
  statsForHero,
  tavernCapacity,
  xpToReach,
} from '#root/common/helpers/hero'

test('HERO_CLASSES is the four classes', () => {
  assert.deepEqual([...HERO_CLASSES].sort(), ['archer', 'knight', 'mage', 'rogue'])
})

test('statsForHero at level 1 equals base stats', () => {
  assert.deepEqual(statsForHero('knight', 1), BASE_STATS.knight)
})

test('statsForHero scales linearly per level and clamps at MAX_HERO_LEVEL', () => {
  const l2 = statsForHero('mage', 2)
  assert.equal(l2.atk, BASE_STATS.mage.atk + 5)
  const over = statsForHero('mage', MAX_HERO_LEVEL + 10)
  assert.deepEqual(over, statsForHero('mage', MAX_HERO_LEVEL))
})

test('xpToReach is monotonic and level 1 needs 0', () => {
  assert.equal(xpToReach(1), 0)
  assert.ok(xpToReach(3) > xpToReach(2))
})

test('levelFromXp maps xp back to level at boundaries', () => {
  assert.equal(levelFromXp(0), 1)
  assert.equal(levelFromXp(xpToReach(2)), 2)
  assert.equal(levelFromXp(xpToReach(2) - 1), 1)
})

test('applyXp accumulates and flags a level-up', () => {
  const r = applyXp(0, 1, xpToReach(2))
  assert.equal(r.level, 2)
  assert.equal(r.leveledUp, true)
  const r2 = applyXp(0, 1, 1)
  assert.equal(r2.leveledUp, false)
})

test('recruitCost escalates with the current hero count', () => {
  assert.equal(recruitCost(0).cube, 1000n)
  assert.equal(recruitCost(0).gold, 300)
  assert.equal(recruitCost(1).cube, 2000n)
  assert.equal(recruitCost(2).gold, 900)
})

test('tavernCapacity is 1 + tavern level', () => {
  assert.equal(tavernCapacity(0), 1)
  assert.equal(tavernCapacity(3), 4)
})
