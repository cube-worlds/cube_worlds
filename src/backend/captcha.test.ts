/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import process from 'node:process'
import { before, test } from 'node:test'
import { generateCaptchaToken, verifyCaptchaToken } from '#root/backend/captcha'

const USER_ID = 12345
const EXPECTED_KILLS = 7
const SECRET = 'test-bot-token-for-captcha-suite'

before(() => {
  process.env.BOT_TOKEN = SECRET
})

const MIN_DWELL_MS = 20_000
const MAX_AGE_MS = 10 * 60 * 1000

function issueValid() {
  return generateCaptchaToken(USER_ID, EXPECTED_KILLS)
}

test('verifyCaptchaToken accepts a freshly-generated token after the dwell window', () => {
  const issued = issueValid()
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: true })
})

test('verifyCaptchaToken rejects when no captcha is pending (missing nonce)', () => {
  const issued = issueValid()

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    undefined,
    issued.issuedAt,
  )

  assert.deepEqual(result, { ok: false, reason: 'no_pending_captcha' })
})

test('verifyCaptchaToken rejects when no captcha is pending (missing issuedAt)', () => {
  const issued = issueValid()

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    issued.nonce,
    undefined,
  )

  assert.deepEqual(result, { ok: false, reason: 'no_pending_captcha' })
})

test('verifyCaptchaToken rejects malformed tokens', () => {
  const issued = issueValid()

  const tooFew = verifyCaptchaToken(
    USER_ID,
    'a:b:c',
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
  )
  assert.deepEqual(tooFew, { ok: false, reason: 'bad_format' })

  const tooMany = verifyCaptchaToken(
    USER_ID,
    'a:b:c:d:e',
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
  )
  assert.deepEqual(tooMany, { ok: false, reason: 'bad_format' })
})

test('verifyCaptchaToken rejects when expectedKills changes after issue', () => {
  const issued = issueValid()
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS + 1,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'kills_mismatch' })
})

test('verifyCaptchaToken rejects when nonce does not match storage', () => {
  const issued = issueValid()
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    'a-different-nonce-from-elsewhere',
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'nonce_mismatch' })
})

test('verifyCaptchaToken rejects when token timestamp is non-numeric', () => {
  const issued = issueValid()
  const parts = issued.token.split(':')
  parts[2] = 'NaN-not-a-number'
  const tampered = parts.join(':')

  const result = verifyCaptchaToken(
    USER_ID,
    tampered,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
  )

  assert.deepEqual(result, { ok: false, reason: 'bad_timestamp' })
})

test('verifyCaptchaToken rejects when token timestamp differs from stored', () => {
  const issued = issueValid()
  const parts = issued.token.split(':')
  parts[2] = String(issued.issuedAt.getTime() - 1)
  const tampered = parts.join(':')

  const result = verifyCaptchaToken(
    USER_ID,
    tampered,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
  )

  assert.deepEqual(result, { ok: false, reason: 'timestamp_mismatch' })
})

test('verifyCaptchaToken rejects too-fast solves (anti-bot dwell)', () => {
  const issued = issueValid()
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS - 1

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'too_fast' })
})

test('verifyCaptchaToken rejects expired tokens', () => {
  const issued = issueValid()
  const now = issued.issuedAt.getTime() + MAX_AGE_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'expired' })
})

test('verifyCaptchaToken rejects HMAC tampering', () => {
  const issued = issueValid()
  const parts = issued.token.split(':')
  // flip the last hex character of the HMAC to invalidate the signature
  const lastHex = parts[3]
  const flipped = lastHex.endsWith('0')
    ? `${lastHex.slice(0, -1)}1`
    : `${lastHex.slice(0, -1)}0`
  parts[3] = flipped
  const tampered = parts.join(':')
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    tampered,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'hmac_mismatch' })
})

test('verifyCaptchaToken rejects HMAC of different length (decoder error)', () => {
  const issued = issueValid()
  const parts = issued.token.split(':')
  parts[3] = 'deadbeef'
  const tampered = parts.join(':')
  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    tampered,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'hmac_error' })
})

test('verifyCaptchaToken does not validate against tokens issued for a different user', () => {
  const otherUserToken = generateCaptchaToken(USER_ID + 1, EXPECTED_KILLS)
  const now = otherUserToken.issuedAt.getTime() + MIN_DWELL_MS + 1

  const result = verifyCaptchaToken(
    USER_ID,
    otherUserToken.token,
    EXPECTED_KILLS,
    otherUserToken.nonce,
    otherUserToken.issuedAt,
    now,
  )

  assert.deepEqual(result, { ok: false, reason: 'hmac_mismatch' })
})

test('verifyCaptchaToken rejects when BOT_TOKEN is missing', () => {
  const issued = issueValid()
  const saved = process.env.BOT_TOKEN
  delete process.env.BOT_TOKEN
  try {
    const result = verifyCaptchaToken(
      USER_ID,
      issued.token,
      EXPECTED_KILLS,
      issued.nonce,
      issued.issuedAt,
    )
    assert.deepEqual(result, { ok: false, reason: 'no_secret' })
  } finally {
    process.env.BOT_TOKEN = saved
  }
})

test('generateCaptchaToken returns a token that round-trips through verify', () => {
  const issued = generateCaptchaToken(USER_ID, EXPECTED_KILLS)

  assert.equal(issued.token.split(':').length, 4)
  assert.equal(issued.nonce.length, 32) // 16 bytes hex-encoded
  assert.ok(Number.isInteger(issued.issuedAt.getTime()))

  const now = issued.issuedAt.getTime() + MIN_DWELL_MS + 100
  const verified = verifyCaptchaToken(
    USER_ID,
    issued.token,
    EXPECTED_KILLS,
    issued.nonce,
    issued.issuedAt,
    now,
  )
  assert.deepEqual(verified, { ok: true })
})

test('generateCaptchaToken issues distinct nonces across calls', () => {
  const a = generateCaptchaToken(USER_ID, EXPECTED_KILLS)
  const b = generateCaptchaToken(USER_ID, EXPECTED_KILLS)
  assert.notEqual(a.nonce, b.nonce)
})
