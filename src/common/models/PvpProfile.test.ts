/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { PvpProfileModel } from '#root/common/models/PvpProfile'

test('PvpProfileModel has a unique userId index', () => {
  const userIdPath = PvpProfileModel.schema.paths.userId
  assert.ok(userIdPath, 'missing userId path')
  assert.equal((userIdPath.options as { unique?: boolean }).unique, true)
})

test('PvpProfileModel exposes ladder + shield + raid-day paths with spec defaults', () => {
  const paths = PvpProfileModel.schema.paths
  for (const p of ['userId', 'rating', 'wins', 'losses', 'shieldUntil', 'raidDay', 'raidsToday']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
  assert.equal((paths.rating.options as { default?: number }).default, 1000)
  assert.equal((paths.raidsToday.options as { default?: number }).default, 0)
  assert.equal((paths.raidDay.options as { default?: number }).default, -1)
})
