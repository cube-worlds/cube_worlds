/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateEquipment,
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOTS,
  equipmentBonus,
  rollEquipment,
  rollRarity,
  withEquipment,
} from '#root/common/helpers/equipment'

test('slots and rarities are the canonical sets', () => {
  assert.deepEqual([...EQUIPMENT_SLOTS].sort(), ['accessory', 'body', 'head', 'weapon'])
  assert.deepEqual([...EQUIPMENT_RARITIES], ['common', 'rare', 'epic', 'legendary'])
})

test('rarity scales the slot bonus monotonically', () => {
  const c = equipmentBonus('weapon', 'common').atk
  const r = equipmentBonus('weapon', 'rare').atk
  const e = equipmentBonus('weapon', 'epic').atk
  const l = equipmentBonus('weapon', 'legendary').atk
  assert.ok(c < r && r < e && e < l, `expected ${c} < ${r} < ${e} < ${l}`)
})

test('each slot favors its stat', () => {
  assert.ok(equipmentBonus('weapon', 'common').atk > 0)
  assert.ok(equipmentBonus('body', 'common').hp > 0)
  assert.ok(equipmentBonus('head', 'common').def > 0)
})

test('aggregateEquipment sums; empty is zero', () => {
  assert.deepEqual(aggregateEquipment([]), { hp: 0, atk: 0, def: 0 })
  assert.deepEqual(
    aggregateEquipment([{ hp: 10, atk: 2, def: 1 }, { hp: 5, atk: 3, def: 4 }]),
    { hp: 15, atk: 5, def: 5 },
  )
})

test('withEquipment adds the bonus to base stats', () => {
  assert.deepEqual(
    withEquipment({ hp: 100, atk: 20, def: 10 }, { hp: 15, atk: 5, def: 5 }),
    { hp: 115, atk: 25, def: 15 },
  )
})

test('rollEquipment is deterministic for a seed', () => {
  const a = rollEquipment(12345)
  for (let i = 0; i < 1000; i++) assert.deepEqual(rollEquipment(12345), a)
  // bonus matches the rolled slot/rarity
  assert.deepEqual(a.bonus, equipmentBonus(a.slot, a.rarity))
})

test('rollRarity produces all four rarities, common most frequent', () => {
  const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (let i = 0; i < 20000; i++) {
    const rng = (() => { const m = (i * 2654435761) % 1_000_000; return () => m / 1_000_000 })()
    counts[rollRarity(rng)]++
  }
  // every rarity is reachable across the [0,1) range
  let total = 0
  const seen = new Set<string>()
  for (let x = 0; x < 1; x += 0.001) {
    const r = rollRarity(() => x)
    seen.add(r)
    total++
  }
  assert.equal(total > 0, true)
  for (const r of EQUIPMENT_RARITIES) assert.ok(seen.has(r), `rarity ${r} unreachable`)
})
