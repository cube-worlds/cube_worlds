/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { POOL_PER_WORLD, WORLD_DEFS, worldSeedDocs } from '#root/common/models/World'

test('there are five worlds with stable ids', () => {
  assert.equal(WORLD_DEFS.length, 5)
  assert.deepEqual(
    WORLD_DEFS.map((w) => w.worldId),
    ['frostvault', 'emberwild', 'sunken-cube', 'verdant-maze', 'storm-spire'],
  )
})

test('worldSeedDocs builds one pooled doc per world for a tick', () => {
  const docs = worldSeedDocs(42)
  assert.equal(docs.length, 5)
  assert.deepEqual(docs[0], {
    tickId: 42,
    worldId: 'frostvault',
    name: 'Frostvault',
    cubePool: POOL_PER_WORLD,
    totalWeight: 0,
    explorerCount: 0,
    settled: false,
  })
})
