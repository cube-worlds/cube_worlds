import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// A stateless, single-use HMAC token for the rewarded-ad reward callback,
// mirroring the wallet-nonce in ton-proof.ts but kept pure: the secret is
// injected, so this is config-free and unit-testable. Format:
//   <userId>:<expiresAtMs>:<rand>:<hmac>
// where hmac = HMAC_SHA256(secret, "<userId>:<expiresAtMs>:<rand>").hex()
export const AD_NONCE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export interface AdNonce {
  payload: string
  rand: string
  validUntil: number
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function issueAdNonce(
  secret: string,
  userId: number,
  now: number = Date.now(),
  rand: string = randomBytes(16).toString('hex'),
): AdNonce {
  const expiresAt = now + AD_NONCE_TTL_MS
  const body = `${userId}:${expiresAt}:${rand}`
  return { payload: `${body}:${sign(secret, body)}`, rand, validUntil: expiresAt }
}

export interface VerifiedAdNonce {
  userId: number
  rand: string
}

// Returns the parsed nonce if the HMAC matches and it has not expired; otherwise
// null. The caller still enforces single-use (AdGrant unique index) + daily cap.
export function verifyAdNonce(
  secret: string,
  payload: string,
  now: number = Date.now(),
): VerifiedAdNonce | null {
  const parts = payload.split(':')
  if (parts.length !== 4)
    return null
  const [userIdStr, expiresStr, rand, mac] = parts
  const body = `${userIdStr}:${expiresStr}:${rand}`
  const expected = sign(secret, body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return null
  if (!/^\d+$/.test(expiresStr) || Number(expiresStr) < now)
    return null
  const userId = Number(userIdStr)
  if (!Number.isInteger(userId) || userId <= 0)
    return null
  return { userId, rand }
}
