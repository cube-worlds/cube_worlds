/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunk } from '#root/common/helpers/keyboard'

test('chunk splits an array into fixed-size groups', () => {
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]])
})

test('chunk leaves a smaller final group when the length is not divisible by size', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})

test('chunk returns an empty array for an empty input', () => {
  assert.deepEqual(chunk<number>([], 3), [])
})

test('chunk returns one group containing all items when size exceeds array length', () => {
  assert.deepEqual(chunk([1, 2], 10), [[1, 2]])
})

test('chunk preserves element identity (does not clone values)', () => {
  const a = { value: 1 }
  const b = { value: 2 }
  const result = chunk([a, b], 1)
  assert.equal(result[0][0], a)
  assert.equal(result[1][0], b)
})
