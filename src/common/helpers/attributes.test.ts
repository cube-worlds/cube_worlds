/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomAttributes } from '#root/common/helpers/attributes'

test('randomAttributes returns the full attribute list', () => {
  const result = randomAttributes()
  assert.ok(result.length >= 110, `expected ≥ 110 attributes, got ${result.length}`)
  assert.ok(result.length <= 130, `expected ≤ 130 attributes, got ${result.length}`)
})

test('randomAttributes produces { trait_type: string, value: number } shape', () => {
  const result = randomAttributes()
  for (const trait of result) {
    assert.equal(typeof trait.trait_type, 'string')
    assert.ok(trait.trait_type.length > 0)
    assert.equal(typeof trait.value, 'number')
  }
})

test('randomAttributes assigns each value in the inclusive range 1..10', () => {
  // run several times to exercise the RNG enough that we'd see out-of-range values
  for (let i = 0; i < 20; i++) {
    const result = randomAttributes()
    for (const { value } of result) {
      assert.ok(
        Number.isInteger(value) && value >= 1 && value <= 10,
        `value ${value} outside 1..10`,
      )
    }
  }
})

test('randomAttributes returns values sorted descending', () => {
  for (let i = 0; i < 20; i++) {
    const result = randomAttributes()
    for (let j = 1; j < result.length; j++) {
      assert.ok(
        result[j - 1].value >= result[j].value,
        `not descending at index ${j}: ${result[j - 1].value} < ${result[j].value}`,
      )
    }
  }
})

test('randomAttributes preserves the well-known trait names', () => {
  const result = randomAttributes()
  const names = new Set(result.map((t) => t.trait_type))
  for (const expected of ['Perseverance', 'Courage', 'Joy', 'Bellicosity']) {
    assert.ok(names.has(expected), `missing trait ${expected}`)
  }
})
