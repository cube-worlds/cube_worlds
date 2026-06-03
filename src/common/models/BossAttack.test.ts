/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { BossAttackModel } from '#root/common/models/BossAttack'
import { BossRewardModel } from '#root/common/models/BossReward'

test('BossAttackModel exposes paths and a unique (userId, weekId, day) index', () => {
  const paths = BossAttackModel.schema.paths
  for (const p of ['userId', 'weekId', 'day', 'heroId', 'seed', 'damage']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
  const idx = BossAttackModel.schema.indexes()
  const uniq = idx.find(([keys]: [Record<string, unknown>, Record<string, unknown>]) => keys.userId === 1 && keys.weekId === 1 && keys.day === 1)
  assert.ok(uniq, 'missing (userId, weekId, day) index')
  assert.equal(uniq?.[1]?.unique, true)
})

test('BossRewardModel exposes paths and a unique (weekId, userId) index', () => {
  const paths = BossRewardModel.schema.paths
  for (const p of ['weekId', 'userId', 'rarity']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
  const idx = BossRewardModel.schema.indexes()
  const uniq = idx.find(([keys]: [Record<string, unknown>, Record<string, unknown>]) => keys.weekId === 1 && keys.userId === 1)
  assert.ok(uniq, 'missing (weekId, userId) index')
  assert.equal(uniq?.[1]?.unique, true)
})
