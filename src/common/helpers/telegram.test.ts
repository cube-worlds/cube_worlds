/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildInviteUrl,
  buildShareLink,
  findAdminIndex,
  pickLangValue,
} from '#root/common/helpers/telegram'

// pickLangValue — language router (en is the default fallback)

test('pickLangValue returns ru entry for "ru"', () => {
  assert.equal(pickLangValue('ru', { ru: '@ru', en: '@en' }), '@ru')
})

test('pickLangValue returns en entry for "en"', () => {
  assert.equal(pickLangValue('en', { ru: '@ru', en: '@en' }), '@en')
})

test('pickLangValue falls back to en for any unknown language', () => {
  assert.equal(pickLangValue('de', { ru: '@ru', en: '@en' }), '@en')
  assert.equal(pickLangValue('', { ru: '@ru', en: '@en' }), '@en')
  assert.equal(pickLangValue('RU', { ru: '@ru', en: '@en' }), '@en')
})

// findAdminIndex — admin lookup with strict throw on miss

test('findAdminIndex returns 0 for the first admin', () => {
  assert.equal(findAdminIndex(111, [111, 222, 333]), 0)
})

test('findAdminIndex returns the correct index for later admins', () => {
  assert.equal(findAdminIndex(222, [111, 222, 333]), 1)
  assert.equal(findAdminIndex(333, [111, 222, 333]), 2)
})

test('findAdminIndex throws "Not admin" for a non-admin user', () => {
  assert.throws(() => findAdminIndex(999, [111, 222, 333]), /Not admin/)
})

test('findAdminIndex throws on an empty admins list', () => {
  assert.throws(() => findAdminIndex(111, []), /Not admin/)
})

// buildInviteUrl — bot invite link with start parameter

test('buildInviteUrl produces the standard t.me start link', () => {
  assert.equal(
    buildInviteUrl('cube_worlds_bot', 12345),
    'https://t.me/cube_worlds_bot?start=12345',
  )
})

test('buildInviteUrl handles negative or zero user ids verbatim', () => {
  assert.equal(buildInviteUrl('bot', 0), 'https://t.me/bot?start=0')
  assert.equal(buildInviteUrl('bot', -1), 'https://t.me/bot?start=-1')
})

// buildShareLink — Telegram share URL with encoded text

test('buildShareLink wraps the invite url and url-encodes the text', () => {
  const link = buildShareLink('https://t.me/bot?start=1', 'Hello world!')
  assert.equal(
    link,
    'https://t.me/share/url?url=https://t.me/bot?start=1&text=Hello%20world!',
  )
})

test('buildShareLink encodes ampersands and reserved characters in text', () => {
  const link = buildShareLink('https://t.me/bot?start=1', 'a&b=c')
  // text part uses encodeURIComponent — & and = are escaped
  assert.match(link, /text=a%26b%3Dc$/)
})

test('buildShareLink uses encodeURI on the invite url (preserves :/?=&)', () => {
  // The invite url already contains ?start= which encodeURI preserves
  const link = buildShareLink('https://t.me/bot?start=42', 'hi')
  assert.match(link, /url=https:\/\/t\.me\/bot\?start=42/)
})
