/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeImageData } from '#root/bot/callback-data/image-selection'
import { photoKeyboard, SelectImageButton } from '#root/bot/keyboards/photo'

test('photoKeyboard has three rows with the documented layout (2 / 1 / 2)', () => {
  assert.deepEqual(photoKeyboard.map((row) => row.length), [2, 1, 2])
})

test('photoKeyboard buttons have unique callback_data values', () => {
  const flat = photoKeyboard.flat()
  const uniques = new Set(flat.map((b) => b.callback_data))
  assert.equal(uniques.size, flat.length)
})

test('every photoKeyboard callback_data unpacks back to a SelectImageButton value', () => {
  const validValues = new Set<string>(Object.values(SelectImageButton))
  for (const button of photoKeyboard.flat()) {
    const { select } = changeImageData.unpack(button.callback_data)
    assert.ok(
      validValues.has(select),
      `${button.text} -> ${select} is not a SelectImageButton`,
    )
  }
})

test('photoKeyboard covers every SelectImageButton enum value', () => {
  const seen = new Set<string>()
  for (const button of photoKeyboard.flat()) {
    seen.add(changeImageData.unpack(button.callback_data).select)
  }
  for (const value of Object.values(SelectImageButton)) {
    assert.ok(seen.has(value), `missing button for ${value}`)
  }
})
