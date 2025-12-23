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
