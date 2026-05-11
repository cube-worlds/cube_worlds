/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeLanguageData } from '#root/bot/callback-data/change-language'

test('changeLanguageData.pack produces the language: prefix', () => {
  const packed = changeLanguageData.pack({ code: 'en' })
  assert.equal(packed, 'language:en')
})

test('changeLanguageData round-trips through pack + unpack', () => {
  const packed = changeLanguageData.pack({ code: 'ru' })
  const unpacked = changeLanguageData.unpack(packed)
  assert.deepEqual(unpacked, { code: 'ru' })
})
