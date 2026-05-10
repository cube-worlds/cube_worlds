/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { removeMiddle } from '#root/common/helpers/text'

test('removeMiddle returns input unchanged when shorter than 2× corner length', () => {
  // default corner length is 4 — 7 chars (< 8) returned as-is
  assert.equal(removeMiddle('abcdefg'), 'abcdefg')
})

test('removeMiddle replaces middle with ellipsis at 2× corner boundary', () => {
  // exactly 8 chars: '< 8' is false, so it shortens
  assert.equal(removeMiddle('abcdefgh'), 'abcd...efgh')
})

test('removeMiddle truncates a long wallet-like string', () => {
  const wallet = 'UQabcdefghijklmnopqrstuvwxyz0123456789'
  assert.equal(removeMiddle(wallet), 'UQab...6789')
})

test('removeMiddle respects a custom corner length', () => {
  assert.equal(removeMiddle('abcdefghijklmn', 2), 'ab...mn')
  assert.equal(removeMiddle('abcdefghijklmn', 6), 'abcdef...ijklmn')
})

test('removeMiddle leaves empty input as empty', () => {
  assert.equal(removeMiddle(''), '')
})
