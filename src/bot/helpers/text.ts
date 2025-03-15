import { randomBytes } from 'node:crypto'

export function removeMiddle(s: string, cornerLength: number = 4) {
  if (s.length < cornerLength * 2) {
    return s
  }
  const first = s.slice(0, cornerLength)
  const last = s.slice(-cornerLength)
  return `${first}...${last}`
}

export function generateRandomString(length: number): string {
  const randomBytesBuffer = randomBytes(Math.ceil((length * 3) / 4))
  return randomBytesBuffer
    .toString('base64')
    .slice(0, length)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
