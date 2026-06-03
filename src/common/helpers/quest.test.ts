/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DUNGEON_XP_WIN, dungeonLoot } from '#root/common/helpers/dungeon'
import {
  EQUIP_DROP_CHANCE,
  isQuestReady,
  QUEST_DURATION_MS,
  questLoot,
  questSeed,
  questXp,
  rollQuestDrop,
} from '#root/common/helpers/quest'

test('quest duration is 8 hours', () => {
  assert.equal(QUEST_DURATION_MS, 8 * 60 * 60 * 1000)
})

test('isQuestReady is true at or after endsAt', () => {
  const ends = new Date(1_000_000)
  assert.equal(isQuestReady(new Date(999_999), ends), false)
  assert.equal(isQuestReady(new Date(1_000_000), ends), true)
  assert.equal(isQuestReady(new Date(1_000_001), ends), true)
})

test('questSeed is stable for the same inputs', () => {
  assert.equal(questSeed(7, 'h1', 123), questSeed(7, 'h1', 123))
  assert.notEqual(questSeed(7, 'h1', 123), questSeed(7, 'h1', 124))
})

test('questLoot is deterministic and strictly richer than dungeon loot', () => {
  for (const lvl of [1, 5, 15, 30]) {
    for (const seed of [1, 42, 99999, 2 ** 31]) {
      const q = questLoot(seed, lvl)
      assert.deepEqual(q, questLoot(seed, lvl), 'deterministic')
      const d = dungeonLoot(seed, lvl)
      assert.ok(q.gold > d.gold, `quest gold ${q.gold} should beat dungeon ${d.gold} at L${lvl}`)
    }
  }
})

test('questXp exceeds a dungeon win', () => {
  assert.ok(questXp(1) > DUNGEON_XP_WIN)
  assert.ok(questXp(30) > questXp(1))
})

test('rollQuestDrop is deterministic and yields both null and items across seeds', () => {
  let nulls = 0
  let items = 0
  for (let seed = 0; seed < 2000; seed++) {
    const drop = rollQuestDrop(seed)
    assert.deepEqual(rollQuestDrop(seed), drop, 'deterministic')
    if (drop === null) nulls++
    else items++
  }
  assert.ok(nulls > 0 && items > 0, `expected both outcomes, got ${nulls} null / ${items} items`)
  // roughly aligned with EQUIP_DROP_CHANCE (loose bound — determinism, not statistics)
  assert.ok(items / 2000 < EQUIP_DROP_CHANCE * 2, 'drop rate should be near the configured chance')
})
