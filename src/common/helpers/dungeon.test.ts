/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dayBucket,
  DUNGEON_XP_LOSS,
  DUNGEON_XP_WIN,
  dungeonEnemy,
  dungeonLoot,
  dungeonSeed,
} from '#root/common/helpers/dungeon'

test('dayBucket floors epoch ms into UTC-day buckets', () => {
  assert.equal(dayBucket(new Date(0)), 0)
  assert.equal(dayBucket(new Date(86_400_000 - 1)), 0)
  assert.equal(dayBucket(new Date(86_400_000)), 1)
})

test('dungeonSeed is deterministic per (user, hero, day)', () => {
  assert.equal(dungeonSeed(7, 'h1', 19876), dungeonSeed(7, 'h1', 19876))
  assert.notEqual(dungeonSeed(7, 'h1', 19876), dungeonSeed(7, 'h1', 19877))
  assert.notEqual(dungeonSeed(7, 'h1', 19876), dungeonSeed(8, 'h1', 19876))
})

test('dungeonEnemy scales with hero level', () => {
  const e1 = dungeonEnemy(1); const e5 = dungeonEnemy(5)
  assert.ok(e5.hp > e1.hp && e5.atk > e1.atk && e5.def >= e1.def)
})

test('dungeonLoot is deterministic from the seed and all-positive', () => {
  const a = dungeonLoot(12345, 3); const b = dungeonLoot(12345, 3)
  assert.deepEqual(a, b)
  assert.ok(a.gold > 0 && a.iron >= 0 && a.mana >= 0 && a.food >= 0)
  assert.ok(dungeonLoot(12345, 10).gold > dungeonLoot(12345, 1).gold)
})

test('XP constants: a win grants more than a loss', () => {
  assert.ok(DUNGEON_XP_WIN > DUNGEON_XP_LOSS)
})
