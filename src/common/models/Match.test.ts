/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_MODES, MatchModel } from '#root/common/models/Match'

test('MATCH_MODES enumerates arena and raid', () => {
  assert.deepEqual([...MATCH_MODES], ['arena', 'raid'])
})

test('MatchModel exposes the snapshot + result paths', () => {
  const paths = MatchModel.schema.paths
  for (const p of ['mode', 'attackerId', 'defenderId', 'attacker', 'defender', 'stake', 'status', 'seed', 'attackerWon', 'ratingDelta', 'xpGained', 'lootGold', 'lootIron', 'lootMana', 'lootFood']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
  assert.equal((paths.status.options as { default?: string }).default, 'pending')
})

test('MatchModel indexes pending sweep and both history directions', () => {
  const idx = MatchModel.schema.indexes()
  const has = (keys: Record<string, number>) =>
    idx.some(([k]: [Record<string, unknown>, unknown]) => JSON.stringify(k) === JSON.stringify(keys))
  assert.ok(has({ attackerId: 1, status: 1 }), 'missing (attackerId, status) index')
  assert.ok(has({ attackerId: 1, createdAt: -1 }), 'missing (attackerId, createdAt) index')
  assert.ok(has({ defenderId: 1, createdAt: -1 }), 'missing (defenderId, createdAt) index')
})
