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
