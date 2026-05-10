/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateRandomString } from '#root/common/helpers/random'

test('generateRandomString returns a string of the requested length', () => {
  for (const length of [1, 8, 16, 32, 64]) {
    const s = generateRandomString(length)
    assert.equal(s.length, length, `expected length ${length}, got ${s.length}`)
  }
})

test('generateRandomString uses url-safe characters only (no +, /, =)', () => {
  for (let i = 0; i < 50; i++) {
    const s = generateRandomString(64)
    assert.match(s, /^[\w-]+$/, `unexpected char in ${s}`)
  }
})

test('generateRandomString returns different values across calls (overwhelmingly likely)', () => {
  const samples = new Set<string>()
  for (let i = 0; i < 50; i++) samples.add(generateRandomString(32))
  assert.equal(samples.size, 50)
})
