import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

function sanitizeFilename(name: string): string {
  return name.replaceAll(/[^\w-]/g, '_')
}

export function folderPath(username: string): string {
  const safeName = sanitizeFilename(username)
  const fp = path.resolve('./data', safeName)
  if (!fp.startsWith(path.resolve('./data'))) {
    throw new Error('Invalid username for path')
  }
  if (!fs.existsSync(fp)) {
    fs.mkdirSync(fp, { recursive: true })
  }
  return fp
}

export function saveImage(
  username: string,
  fileName: string,
  content: Buffer,
): string {
  const fp = folderPath(username)
  const safeFileName = path.basename(fileName)
  const filePath = path.join(fp, safeFileName)
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
  const fileExtension = imageFileName.split('.').pop()
  const newFileName = `${original ? 'ava_' : ''}${username}_${adminIndex}.${fileExtension}`
  return saveImage(username, newFileName, buffer)
}

export function saveJSON(
  adminIndex: number,
  username: string,
  json: object,
): string {
  const jsonPath = path.join(
    folderPath(username),
    `${username}_${adminIndex}.json`,
  )
  fs.writeFileSync(jsonPath, JSON.stringify(json))
  return jsonPath
}
