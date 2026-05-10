import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

const DATA_ROOT = path.resolve('./data')
const SAFE_COMPONENT = /^[\w.-]+$/

export function sanitizeFilename(name: string): string {
  const cleaned = name.replaceAll(/[^\w.-]/g, '_')
  return cleaned.length === 0 ? '_' : cleaned
}

export function folderPath(username: string): string {
  const safeName = sanitizeFilename(username)
  const fp = path.resolve(DATA_ROOT, safeName)
  if (path.dirname(fp) !== DATA_ROOT) {
    throw new Error('Invalid username for path')
  }
  if (!fs.existsSync(fp)) {
    fs.mkdirSync(fp, { recursive: true })
  }
  return fp
}

/**
 * Build an absolute path inside the user's data folder, sanitizing both the
 * username and the filename. Throws if the resolved path would escape the
 * user's folder. All file writes for user-derived data must go through this.
 */
export function userFilePath(username: string, filename: string): string {
  const dir = folderPath(username)
  const safeFile = sanitizeFilename(path.basename(filename))
  if (!SAFE_COMPONENT.test(safeFile)) {
    throw new Error('Invalid filename')
  }
  const fp = path.resolve(dir, safeFile)
  if (path.dirname(fp) !== dir) {
    throw new Error('Resolved path escapes user folder')
  }
  return fp
}

export function saveImage(
  username: string,
  fileName: string,
  content: Buffer,
): string {
  const filePath = userFilePath(username, fileName)
  fs.writeFileSync(filePath, content)
  return filePath
}

export async function saveImageFromUrl(
  imageURL: string,
  adminIndex: number,
  username: string,
  original: boolean,
): Promise<string> {
  const image = await fetch(imageURL)
  const arrayBuffer = await image.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf('/') ?? 0) + 1) ?? ''
  const rawExtension = imageFileName.split('.').pop() ?? ''
  const safeExtension = sanitizeFilename(rawExtension).slice(0, 8) || 'bin'
  const safeUsername = sanitizeFilename(username)
  const newFileName = `${original ? 'ava_' : ''}${safeUsername}_${adminIndex}.${safeExtension}`
  return saveImage(username, newFileName, buffer)
}

export function saveJSON(
  adminIndex: number,
  username: string,
  json: object,
): string {
  const safeUsername = sanitizeFilename(username)
  const jsonPath = userFilePath(
    username,
    `${safeUsername}_${adminIndex}.json`,
  )
  fs.writeFileSync(jsonPath, JSON.stringify(json))
  return jsonPath
}
