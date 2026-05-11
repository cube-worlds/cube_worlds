/* eslint-disable test/no-import-node-test */
import type { User } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { photoCaption } from '#root/bot/keyboards/queue-menu'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'alice',
    description: undefined,
    nftDescription: undefined,
    nftImage: undefined,
    nftJson: undefined,
    minted: false,
    nftUrl: undefined,
    ...overrides,
  } as unknown as User
}

test('photoCaption renders the mention header with id and name', () => {
  const caption = photoCaption(makeUser({ id: 42, name: 'bob' }))
  assert.match(caption, /^@\[bob\]\(tg:\/\/user\?id=42\)/)
})

test('photoCaption truncates description to 100 chars and appends ... when nftDescription is set', () => {
  const longDescription = 'x'.repeat(150)
  const caption = photoCaption(makeUser({
    description: longDescription,
    nftDescription: 'final',
  }))
  // 100 x's then ...
  assert.match(caption, /Comment: `x{100}\.\.\.`/)
  assert.match(caption, /Description: `final`/)
})

test('photoCaption keeps description up to 700 chars when nftDescription is unset', () => {
  const longDescription = 'y'.repeat(800)
  const caption = photoCaption(makeUser({ description: longDescription }))
  // exactly 700 y's, no ellipsis
  assert.match(caption, /Comment: `y{700}`/)
  assert.doesNotMatch(caption, /y{700}\.\.\./)
})

test('photoCaption omits Image and JSON links when nftImage/nftJson are missing', () => {
  const caption = photoCaption(makeUser({}))
  assert.doesNotMatch(caption, /\[Image\]\(/)
  assert.doesNotMatch(caption, /\[JSON\]\(/)
})

test('photoCaption renders ✅ + NFT link when minted, ❌ otherwise', () => {
  const minted = photoCaption(makeUser({ minted: true, nftUrl: 'https://getgems.io/x' }))
  assert.match(minted, /Minted: ✅ \[NFT\]\(https:\/\/getgems\.io\/x\)/)

  const notMinted = photoCaption(makeUser({ minted: false }))
  assert.match(notMinted, /Minted: ❌ $/m)
})
