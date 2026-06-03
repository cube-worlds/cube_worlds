/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { EquipmentModel } from '#root/common/models/Equipment'

test('EquipmentModel exposes the expected schema paths', () => {
  const paths = EquipmentModel.schema.paths
  for (const p of ['userId', 'slot', 'rarity', 'bonusHp', 'bonusAtk', 'bonusDef', 'equippedHeroId', 'source', 'nftMinted']) {
    assert.ok(paths[p], `missing path ${p}`)
  }
})

test('EquipmentModel has a unique partial (equippedHeroId, slot) index', () => {
  const idx = EquipmentModel.schema.indexes()
  const compound = idx.find(([keys]: [Record<string, unknown>, Record<string, unknown>]) => keys.equippedHeroId === 1 && keys.slot === 1)
  assert.ok(compound, 'missing (equippedHeroId, slot) index')
  assert.equal(compound?.[1]?.unique, true)
  assert.ok(compound?.[1]?.partialFilterExpression, 'index must be partial so inventory (null) is exempt')
})
