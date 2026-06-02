import { randomBytes } from 'node:crypto'

export function generateRandomString(length: number): string {
  const randomBytesBuffer = randomBytes(Math.ceil((length * 3) / 4))
  return randomBytesBuffer
    .toString('base64')
    .slice(0, length)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

// Uniform float in [0, 1) backed by crypto randomness — used for the greedy
// risk roll in expedition settlement.
export function randomFloat(): number {
  return randomBytes(4).readUInt32BE(0) / 0x1_0000_0000
}

// A 32-hex-char random id for idempotency keys (withdrawalId/transferId). Fits
// xRocket's 50-char limit. Uses node:crypto for unbiased randomness.
export function randomId(): string {
  return randomBytes(16).toString('hex')
}
