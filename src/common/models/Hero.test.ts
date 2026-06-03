/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { HeroModel, isFirstHero } from '#root/common/models/Hero'

test('isFirstHero is true only at zero existing heroes', () => {
  assert.equal(isFirstHero(0), true)
  assert.equal(isFirstHero(1), false)
})

test('HeroModel exposes the expected schema paths', () => {
  const paths = HeroModel.schema.paths
  for (const p of ['userId', 'heroClass', 'level', 'xp', 'soulbound', 'nftMinted']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
})
