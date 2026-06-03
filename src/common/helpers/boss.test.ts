/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { bossDamage, bossForWeek, bossRewardTier } from '#root/common/helpers/boss'

test('bossForWeek is deterministic per week and varies across weeks', () => {
  assert.deepEqual(bossForWeek(1000), bossForWeek(1000))
  assert.notDeepEqual(bossForWeek(1000), bossForWeek(1001))
  const b = bossForWeek(1000)
  assert.ok(b.hp > 1000 && b.atk > 0 && b.def >= 0)
  assert.equal(typeof b.name, 'string')
})

test('bossDamage is deterministic', () => {
  const boss = bossForWeek(1000)
  const hero = { hp: 120, atk: 18, def: 12 }
  const d = bossDamage(42, hero, boss)
  for (let i = 0; i < 1000; i++) assert.equal(bossDamage(42, hero, boss), d)
  assert.ok(d > 0)
})

test('bossDamage is monotonic in attack power', () => {
  const boss = bossForWeek(1000)
  const bare = { hp: 120, atk: 18, def: 12 }
  const strong = { hp: 120, atk: 40, def: 12 }
  assert.ok(bossDamage(42, strong, boss) > bossDamage(42, bare, boss))
})

test('bossRewardTier cuts by percentile', () => {
  assert.equal(bossRewardTier(0, 100), 'legendary') // top
  assert.equal(bossRewardTier(4, 100), 'legendary') // 4% still top tier
  assert.equal(bossRewardTier(10, 100), 'epic') // 10%
  assert.equal(bossRewardTier(30, 100), 'rare') // 30%
  assert.equal(bossRewardTier(99, 100), null) // bottom gets nothing
  assert.equal(bossRewardTier(0, 0), null) // empty board
})
