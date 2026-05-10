/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toEmoji } from '#root/common/helpers/emoji'

// 10 has its own dedicated single-character emoji

test('toEmoji renders 10 as 🔟 (single glyph, not "1️⃣0️⃣")', () => {
  assert.equal(toEmoji(10), '🔟')
})

// every single digit maps to its keycap emoji

test('toEmoji renders 0 as 0️⃣', () => {
  assert.equal(toEmoji(0), '0️⃣')
})

test('toEmoji renders each digit 1-9 as its keycap emoji', () => {
  assert.equal(toEmoji(1), '1️⃣')
  assert.equal(toEmoji(2), '2️⃣')
  assert.equal(toEmoji(3), '3️⃣')
  assert.equal(toEmoji(4), '4️⃣')
  assert.equal(toEmoji(5), '5️⃣')
  assert.equal(toEmoji(6), '6️⃣')
  assert.equal(toEmoji(7), '7️⃣')
  assert.equal(toEmoji(8), '8️⃣')
  assert.equal(toEmoji(9), '9️⃣')
})

// multi-digit numbers concatenate keycap emojis (no special handling beyond 10)

test('toEmoji concatenates keycap emojis for multi-digit numbers', () => {
  assert.equal(toEmoji(11), '1️⃣1️⃣')
  assert.equal(toEmoji(42), '4️⃣2️⃣')
  assert.equal(toEmoji(100), '1️⃣0️⃣0️⃣')
})

test('toEmoji handles negative numbers by prefixing the literal "-"', () => {
  // The minus sign is not in the replace map, so it stays unchanged.
  assert.equal(toEmoji(-3), '-3️⃣')
})
