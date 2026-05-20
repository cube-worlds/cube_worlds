/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import process from 'node:process'
import test from 'node:test'
import { Address, beginCell } from '@ton/core'
import { keyPairFromSeed, sign } from '@ton/crypto'
import { issueNonce, verifyProof } from '#root/backend/ton-proof'

const BOT_TOKEN_FOR_SUITE = 'ton-proof-test-bot-token'

function withBotToken(t: { after: (fn: () => void) => void }) {
  const saved = process.env.BOT_TOKEN
  process.env.BOT_TOKEN = BOT_TOKEN_FOR_SUITE
  t.after(() => {
    if (saved === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = saved
  })
}

const TON_PROOF_PREFIX = 'ton-proof-item-v2/'
const TON_CONNECT_PREFIX = Buffer.concat([
  Buffer.from([0xFF, 0xFF]),
  Buffer.from('ton-connect', 'utf8'),
])

function int32LE(v: number) {
  const b = Buffer.alloc(4)
  b.writeInt32LE(v, 0)
  return b
}
function uint32LE(v: number) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(v, 0)
  return b
}
function uint64LE(v: number) {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(BigInt(v), 0)
  return b
}

function buildSignatureTarget(
  address: Address,
  domain: string,
  timestampSec: number,
  payload: string,
): Buffer {
  const domainBytes = Buffer.from(domain, 'utf8')
  const payloadBytes = Buffer.from(payload, 'utf8')
  const message = Buffer.concat([
    Buffer.from(TON_PROOF_PREFIX, 'utf8'),
    int32LE(address.workChain),
    address.hash,
    uint32LE(domainBytes.length),
    domainBytes,
    uint64LE(timestampSec),
    payloadBytes,
  ])
  const messageHash = createHash('sha256').update(message).digest()
  return createHash('sha256').update(Buffer.concat([TON_CONNECT_PREFIX, messageHash])).digest()
}

interface Fixture {
  userId: number
  domain: string
  now: number
  payload: string
  publicKey: string
  walletStateInit: string
  address: string
  proof: {
    timestamp: number
    domain: { lengthBytes: number, value: string }
    payload: string
    signature: string
  }
}

function createFixture(overrides: { payload?: string, domain?: string, now?: number } = {}): Fixture {
  const userId = 4242
  const domain = overrides.domain ?? 'cubeworlds.club'
  const now = overrides.now ?? Date.now()
  const seed = randomBytes(32)
  const keys = keyPairFromSeed(seed)

  // Build any cell as the wallet state init; its hash forms the address.
  const stateInitCell = beginCell()
    .storeUint(0x29, 8)
    .storeBuffer(randomBytes(32))
    .endCell()
  const walletStateInit = stateInitCell.toBoc().toString('base64')
  const address = new Address(0, stateInitCell.hash())

  const issued = overrides.payload === undefined
    ? issueNonce(userId, now)
    : { payload: overrides.payload, validUntil: 0 }

  const timestampSec = Math.floor(now / 1000)
  const target = buildSignatureTarget(address, domain, timestampSec, issued.payload)
  const signature = sign(target, keys.secretKey)

  return {
    userId,
    domain,
    now,
    payload: issued.payload,
    publicKey: keys.publicKey.toString('hex'),
    walletStateInit,
    address: address.toString({ urlSafe: true, bounceable: false }),
    proof: {
      timestamp: timestampSec,
      domain: { lengthBytes: Buffer.byteLength(domain, 'utf8'), value: domain },
      payload: issued.payload,
      signature: signature.toString('base64'),
    },
  }
}

test('issueNonce + verifyProof accept a wallet-signed payload', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    // Bound form is bounceable EQ-prefix.
    assert.match(result.boundAddress, /^(EQ|UQ|kQ|0Q)/)
  }
})

test('verifyProof rejects payloads we did not issue (HMAC tampering)', (t) => {
  withBotToken(t)
  const f = createFixture()
  // Re-sign with a tampered payload so the signature is valid but the
  // payload's HMAC won't decode for our BOT_TOKEN.
  const tamperedPayload = `${f.userId}:${f.now + 60_000}:deadbeef:badmac`
  const tamperedTarget = buildSignatureTarget(
    Address.parse(f.address),
    f.domain,
    f.proof.timestamp,
    tamperedPayload,
  )
  const seed = randomBytes(32)
  const keys = keyPairFromSeed(seed)
  const tamperedSig = sign(tamperedTarget, keys.secretKey).toString('base64')

  const result = verifyProof({
    proof: { ...f.proof, payload: tamperedPayload, signature: tamperedSig },
    publicKey: keys.publicKey.toString('hex'),
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'payload_invalid')
})

test('verifyProof rejects payloads issued for a different user', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId + 1,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'payload_invalid')
})

test('verifyProof rejects an expired nonce', (t) => {
  withBotToken(t)
  const f = createFixture()
  const later = f.now + 10 * 60 * 1000 // 10 minutes later — nonce TTL is 5

  const result = verifyProof({
    proof: { ...f.proof, timestamp: Math.floor(later / 1000) },
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: later,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'payload_invalid')
})

test('verifyProof rejects a stale proof timestamp', (t) => {
  withBotToken(t)
  // Nonce still valid but the wallet's clock is way off — outside the 5-min window.
  const f = createFixture()
  const staleTimestamp = Math.floor(f.now / 1000) - 30 * 60
  // Resign with stale timestamp using the same keypair would require knowing
  // it; instead, mutate the timestamp and expect timestamp_window before
  // signature_invalid (timestamp check runs first).
  const result = verifyProof({
    proof: { ...f.proof, timestamp: staleTimestamp },
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'timestamp_window')
})

test('verifyProof rejects a domain that does not match expectedDomain', (t) => {
  withBotToken(t)
  const f = createFixture({ domain: 'cubeworlds.club' })

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: 'evil.example.com',
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'domain_mismatch')
})

test('verifyProof rejects a domain whose lengthBytes is wrong', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: {
      ...f.proof,
      domain: { lengthBytes: f.proof.domain.lengthBytes + 1, value: f.domain },
    },
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'domain_length_mismatch')
})

test('verifyProof rejects an address that does not match the stateInit hash', (t) => {
  withBotToken(t)
  const f = createFixture()
  // Replace the wallet stateInit with a different cell so derived hash drifts.
  const otherInit = beginCell().storeUint(0x99, 8).endCell().toBoc().toString('base64')

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: otherInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'state_init_address_mismatch')
})

test('verifyProof rejects an invalid signature', (t) => {
  withBotToken(t)
  const f = createFixture()
  // Same length, different bytes.
  const badSig = Buffer.alloc(64, 7).toString('base64')

  const result = verifyProof({
    proof: { ...f.proof, signature: badSig },
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'signature_invalid')
})

test('verifyProof rejects a signature signed by a different keypair', (t) => {
  withBotToken(t)
  const f = createFixture()
  const otherKeys = keyPairFromSeed(randomBytes(32))
  const target = buildSignatureTarget(
    Address.parse(f.address),
    f.domain,
    f.proof.timestamp,
    f.proof.payload,
  )
  const otherSig = sign(target, otherKeys.secretKey).toString('base64')

  const result = verifyProof({
    proof: { ...f.proof, signature: otherSig },
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'signature_invalid')
})

test('verifyProof rejects a public key that is not 32 bytes', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: f.proof,
    publicKey: 'ab',
    walletStateInit: f.walletStateInit,
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'bad_public_key')
})

test('verifyProof rejects an unparseable address', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: f.walletStateInit,
    address: 'not-an-address',
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'bad_address')
})

test('verifyProof rejects an unparseable stateInit BOC', (t) => {
  withBotToken(t)
  const f = createFixture()

  const result = verifyProof({
    proof: f.proof,
    publicKey: f.publicKey,
    walletStateInit: 'not-a-real-boc',
    address: f.address,
    expectedDomain: f.domain,
    userId: f.userId,
    now: f.now,
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'bad_state_init')
})

test('issueNonce produces a new payload each call', (t) => {
  withBotToken(t)
  const a = issueNonce(7)
  const b = issueNonce(7)
  assert.notEqual(a.payload, b.payload)
})

test('issueNonce throws when BOT_TOKEN is missing', () => {
  const saved = process.env.BOT_TOKEN
  delete process.env.BOT_TOKEN
  try {
    assert.throws(() => issueNonce(1), /BOT_TOKEN/)
  } finally {
    if (saved === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = saved
  }
})
