/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stringifyBigInt, stringifyBigIntToJSON } from '#root/common/helpers/json'

test('stringifyBigInt serializes bigint values as decimal strings', () => {
  const result = stringifyBigInt({ a: 1n, b: 'x' })
  assert.equal(result, '{"a":"1","b":"x"}')
})

test('stringifyBigInt handles nested bigints', () => {
  const result = stringifyBigInt({
    nested: { value: 9_999_999_999_999_999_999n },
  })
  assert.equal(result, '{"nested":{"value":"9999999999999999999"}}')
})

test('stringifyBigInt leaves non-bigint values untouched', () => {
  const result = stringifyBigInt({ n: 1, s: 'x', a: [1, 2, 3], o: { y: true } })
  assert.equal(result, '{"n":1,"s":"x","a":[1,2,3],"o":{"y":true}}')
})

test('stringifyBigIntToJSON round-trips through JSON.parse', () => {
  const result = stringifyBigIntToJSON({ a: 1n, b: 2 }) as unknown as {
    a: string
    b: number
  }
  assert.deepEqual(result, { a: '1', b: 2 })
})
