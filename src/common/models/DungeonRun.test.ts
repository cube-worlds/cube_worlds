/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DungeonRunModel } from '#root/common/models/DungeonRun'

test('DungeonRunModel has a unique (userId, day) compound index', () => {
  const idx = DungeonRunModel.schema.indexes()
  const compound = idx.find(([keys]: [Record<string, unknown>, Record<string, unknown>]) => keys.userId === 1 && keys.day === 1)
  assert.ok(compound, 'missing (userId, day) index')
  assert.equal(compound?.[1]?.unique, true)
})

test('DungeonRunModel exposes the result + credited paths', () => {
  const paths = DungeonRunModel.schema.paths
  for (const p of ['userId', 'day', 'heroId', 'seed', 'win', 'xpGained', 'credited']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
})
