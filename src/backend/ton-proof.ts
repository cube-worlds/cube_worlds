import { Buffer } from 'node:buffer'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { Address, Cell } from '@ton/core'
import { signVerify } from '@ton/crypto'

// TON Connect ton_proof verification.
// Spec: https://github.com/ton-blockchain/ton-connect/blob/main/requests-responses.md#address-proof-signature-ton_proof
//
// The wallet signs a canonical message bound to (workchain, addr_hash,
// domain, timestamp, dApp-issued payload). We verify that the Ed25519
// signature is valid for the claimed publicKey, that the address derived
// from the stateInit matches the claimed address, that the dApp-issued
// payload is one we recently issued for this Telegram user, and that the
// wallet's timestamp and domain look right.

const NONCE_TTL_MS = 5 * 60 * 1000
const PROOF_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000

const TON_PROOF_PREFIX = 'ton-proof-item-v2/'
const TON_CONNECT_PREFIX = Buffer.concat([
  Buffer.from([0xFF, 0xFF]),
  Buffer.from('ton-connect', 'utf8'),
])

export interface IssuedNonce {
  payload: string
  validUntil: number
}

export interface TonProofPayload {
  timestamp: number
  domain: { lengthBytes: number, value: string }
  payload: string
  signature: string
}

export interface VerifyProofInput {
  proof: TonProofPayload
  publicKey: string
  walletStateInit: string
  address: string
  expectedDomain: string
  userId: number
  now?: number
}

export type VerifyResult =
  | { ok: true, boundAddress: string }
  | { ok: false, reason: string }

function getSecret(): string {
  const secret = process.env.BOT_TOKEN
  if (!secret) {
    throw new Error('BOT_TOKEN is not configured')
  }
  return secret
}

function payloadMac(userId: number, expiresAtMs: number, rand: string): string {
  const secret = getSecret()
  const data = `wallet-proof:${userId}:${expiresAtMs}:${rand}`
  return createHmac('sha256', secret).update(data).digest('hex')
}

export function issueNonce(userId: number, now: number = Date.now()): IssuedNonce {
  const expiresAtMs = now + NONCE_TTL_MS
  const rand = randomBytes(16).toString('hex')
  const mac = payloadMac(userId, expiresAtMs, rand)
  return {
    payload: `${userId}:${expiresAtMs}:${rand}:${mac}`,
    validUntil: Math.floor(expiresAtMs / 1000),
  }
}

interface DecodedNonce {
  userId: number
  expiresAtMs: number
}

function decodeNonce(payload: string, expectedUserId: number, now: number): DecodedNonce | null {
  const parts = payload.split(':')
  if (parts.length !== 4) return null
  const [userIdStr, expiresStr, rand, providedMac] = parts
  const userId = Number(userIdStr)
  const expiresAtMs = Number(expiresStr)
  if (!Number.isInteger(userId) || !Number.isInteger(expiresAtMs)) return null
  if (userId !== expectedUserId) return null
  if (expiresAtMs <= now) return null

  const expectedMac = payloadMac(userId, expiresAtMs, rand)
  try {
    const match = timingSafeEqual(
      Buffer.from(providedMac, 'hex'),
      Buffer.from(expectedMac, 'hex'),
    )
    if (!match) return null
  } catch {
    return null
  }
  return { userId, expiresAtMs }
}

function int32LE(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeInt32LE(value, 0)
  return buf
}

function uint32LE(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value, 0)
  return buf
}

function uint64LE(value: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(value), 0)
  return buf
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
  const toHash = Buffer.concat([TON_CONNECT_PREFIX, messageHash])
  return createHash('sha256').update(toHash).digest()
}

function deriveAddressFromStateInit(walletStateInit: string, workchain: number): Address | null {
  try {
    const cells = Cell.fromBoc(Buffer.from(walletStateInit, 'base64'))
    if (cells.length !== 1) return null
    const hash = cells[0].hash()
    if (hash.length !== 32) return null
    return new Address(workchain, hash)
  } catch {
    return null
  }
}

function parseClaimedAddress(raw: string): Address | null {
  try {
    return Address.parse(raw)
  } catch {
    return null
  }
}

export function verifyProof(input: VerifyProofInput): VerifyResult {
  const now = input.now ?? Date.now()

  const decoded = decodeNonce(input.proof.payload, input.userId, now)
  if (!decoded) return { ok: false, reason: 'payload_invalid' }

  if (!Number.isFinite(input.proof.timestamp)) {
    return { ok: false, reason: 'bad_timestamp' }
  }
  const proofMs = input.proof.timestamp * 1000
  if (Math.abs(now - proofMs) > PROOF_TIMESTAMP_WINDOW_MS) {
    return { ok: false, reason: 'timestamp_window' }
  }

  if (input.proof.domain.value !== input.expectedDomain) {
    return { ok: false, reason: 'domain_mismatch' }
  }
  const domainBytes = Buffer.from(input.proof.domain.value, 'utf8')
  if (input.proof.domain.lengthBytes !== domainBytes.length) {
    return { ok: false, reason: 'domain_length_mismatch' }
  }

  const claimedAddress = parseClaimedAddress(input.address)
  if (!claimedAddress) return { ok: false, reason: 'bad_address' }

  const derived = deriveAddressFromStateInit(input.walletStateInit, claimedAddress.workChain)
  if (!derived) return { ok: false, reason: 'bad_state_init' }
  if (!derived.equals(claimedAddress)) {
    return { ok: false, reason: 'state_init_address_mismatch' }
  }

  let publicKey: Buffer
  try {
    publicKey = Buffer.from(input.publicKey, 'hex')
  } catch {
    return { ok: false, reason: 'bad_public_key' }
  }
  if (publicKey.length !== 32) return { ok: false, reason: 'bad_public_key' }

  let signature: Buffer
  try {
    signature = Buffer.from(input.proof.signature, 'base64')
  } catch {
    return { ok: false, reason: 'bad_signature' }
  }
  if (signature.length !== 64) return { ok: false, reason: 'bad_signature' }

  const target = buildSignatureTarget(
    claimedAddress,
    input.proof.domain.value,
    input.proof.timestamp,
    input.proof.payload,
  )

  if (!signVerify(target, signature, publicKey)) {
    return { ok: false, reason: 'signature_invalid' }
  }

  return {
    ok: true,
    boundAddress: claimedAddress.toString({ bounceable: true }),
  }
}
