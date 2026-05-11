/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeImageData } from '#root/bot/callback-data/image-selection'

test('changeImageData.pack produces the prepare-for-mint: prefix', () => {
  assert.equal(changeImageData.pack({ select: 'mint' }), 'prepare-for-mint:mint')
})

test('changeImageData round-trips through pack + unpack', () => {
  const packed = changeImageData.pack({ select: 'refresh' })
  assert.deepEqual(changeImageData.unpack(packed), { select: 'refresh' })
})

test('changeImageData round-trips arbitrary strings', () => {
  for (const select of ['avatar', 'description', 'upload']) {
    assert.deepEqual(
      changeImageData.unpack(changeImageData.pack({ select })),
      { select },
    )
  }
})
