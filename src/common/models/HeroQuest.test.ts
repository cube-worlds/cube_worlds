/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { HeroQuestModel } from '#root/common/models/HeroQuest'

test('HeroQuestModel exposes the expected schema paths', () => {
  const paths = HeroQuestModel.schema.paths
  for (const p of ['userId', 'heroId', 'startedAt', 'endsAt', 'seed', 'heroLevelAtStart', 'status']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
})

test('HeroQuestModel has a unique partial heroId index (one active quest per hero)', () => {
  const idx = HeroQuestModel.schema.indexes()
  const heroIdx = idx.find(([keys]: [Record<string, unknown>, Record<string, unknown>]) => keys.heroId === 1 && !('slot' in keys))
  assert.ok(heroIdx, 'missing heroId index')
  assert.equal(heroIdx?.[1]?.unique, true)
  assert.deepEqual(heroIdx?.[1]?.partialFilterExpression, { status: 'active' })
})
