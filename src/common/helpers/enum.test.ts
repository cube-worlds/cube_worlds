/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEnumKeyByValue } from '#root/common/helpers/enum'

enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

enum Size {
  Small = 1,
  Medium = 2,
  Large = 3,
}

test('getEnumKeyByValue returns the key for a string-valued enum match', () => {
  assert.equal(getEnumKeyByValue(Color, 'green'), 'Green')
})

test('getEnumKeyByValue returns the key for a numeric-valued enum match', () => {
  // numeric enums emit reverse mappings ('1'→'Small'); Object.keys order puts
  // numeric reverse-keys first, then string keys, so find() lands on the
  // string-keyed entry which is the meaningful name.
  assert.equal(getEnumKeyByValue(Size, 2), 'Medium')
})

test('getEnumKeyByValue returns undefined for missing value', () => {
  assert.equal(getEnumKeyByValue(Color, 'purple'), undefined)
})

test('getEnumKeyByValue returns undefined for empty enum object', () => {
  assert.equal(getEnumKeyByValue({}, 'anything'), undefined)
})
