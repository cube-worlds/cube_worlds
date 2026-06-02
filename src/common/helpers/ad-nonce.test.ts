/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { AD_NONCE_TTL_MS, issueAdNonce, verifyAdNonce } from '#root/common/helpers/ad-nonce'

const SECRET = 'test-ad-secret'

test('issued nonce round-trips through verify', () => {
  const now = 1_000_000
  const nonce = issueAdNonce(SECRET, 42, now, 'fixedrand')
  assert.equal(nonce.validUntil, now + AD_NONCE_TTL_MS)
  const verified = verifyAdNonce(SECRET, nonce.payload, now)
  assert.deepEqual(verified, { userId: 42, rand: 'fixedrand' })
})

test('verify rejects a tampered mac', () => {
  const now = 1_000_000
  const nonce = issueAdNonce(SECRET, 42, now, 'r')
  const tampered = `${nonce.payload.slice(0, -1)}${nonce.payload.endsWith('0') ? '1' : '0'}`
  assert.equal(verifyAdNonce(SECRET, tampered, now), null)
})

test('verify rejects a wrong secret', () => {
  const now = 1_000_000
  const nonce = issueAdNonce(SECRET, 42, now, 'r')
  assert.equal(verifyAdNonce('other-secret', nonce.payload, now), null)
})

test('verify rejects an expired nonce', () => {
  const now = 1_000_000
  const nonce = issueAdNonce(SECRET, 42, now, 'r')
  assert.equal(verifyAdNonce(SECRET, nonce.payload, now + AD_NONCE_TTL_MS + 1), null)
})

test('verify rejects malformed payloads', () => {
  assert.equal(verifyAdNonce(SECRET, 'not-a-nonce', 0), null)
  assert.equal(verifyAdNonce(SECRET, 'a:b:c', 0), null)
  assert.equal(verifyAdNonce(SECRET, 'a:b:c:d:e', 0), null)
})

test('verify rejects a forged non-numeric or non-positive userId even with a valid mac', () => {
  // Build a payload with a valid HMAC over a bad userId — verify must still reject.
  const now = 1_000_000
  const bad = issueAdNonce(SECRET, 0, now, 'r')
  assert.equal(verifyAdNonce(SECRET, bad.payload, now), null)
})
