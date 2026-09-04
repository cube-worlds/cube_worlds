import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sanitizeFilename } from '#root/common/helpers/files'

// Disk cache for NFT art living on IPFS. Public gateways answer 429 to
// browsers on any real traffic, so the webview never talks to them: it asks
// us, we fetch once through whichever gateway answers, and serve from disk
// forever after.
//
// The route in front of this is unauthenticated (it is an <img> src — no
// initData can ride along), so it is a write primitive for anyone who can
// name a CID. Three bounds keep that harmless: a per-file size cap, a total
// cache size cap with eviction, and the per-IP rate limit in server.ts.

export const IPFS_CACHE_FOLDER = 'ipfs'
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_CACHE_BYTES = 256 * 1024 * 1024
// A CID, optionally with a path inside it. No scheme, no query, and no `.`
// or `..` segment — those would walk the gateway URL somewhere else.
const CID_PATH = /^\w[\w.-]*(?:\/[\w.-]+)*$/
const MAX_CID_PATH_LENGTH = 200

export function isValidCidPath(cidPath: string | undefined): cidPath is string {
  return (
    typeof cidPath === 'string'
    && cidPath.length > 0
    && cidPath.length <= MAX_CID_PATH_LENGTH
    && CID_PATH.test(cidPath)
    && !cidPath.split('/').some((segment) => segment === '.' || segment === '..')
  )
}

// Content type from magic bytes, not from whatever the gateway claimed —
// this is also the "is it actually an image" check, so a CID pointing at a
// 5 MB zip never reaches the cache.
export function imageContentType(buffer: Buffer): string | null {
  const magic = buffer.toString('latin1', 0, 12)
  if (magic.startsWith('\x89PNG')) return 'image/png'
  if (magic.startsWith('\xFF\xD8\xFF')) return 'image/jpeg'
  if (magic.startsWith('GIF8')) return 'image/gif'
  if (magic.startsWith('RIFF') && magic.slice(8, 12) === 'WEBP') return 'image/webp'
  return null
}

export interface CachedImage {
  buffer: Buffer
  contentType: string
}

export interface IpfsCacheDependencies {
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<{
    ok: boolean
    status: number
    headers: { get: (name: string) => string | null }
    arrayBuffer: () => Promise<ArrayBuffer>
  }>
  gateways: string[]
  cacheDir: string
  maxImageBytes: number
  maxCacheBytes: number
  timeoutMs: number
  logError: (message: string) => void
}

export function buildIpfsCache(dependencies: IpfsCacheDependencies) {
  // One fetch per CID even when the whole picker asks for it at once
  // (warm + <img> render race on the same 20 images).
  const inFlight = new Map<string, Promise<CachedImage>>()

  function cacheFile(cidPath: string): string {
    return path.join(dependencies.cacheDir, sanitizeFilename(cidPath))
  }

  async function fetchFromGateways(cidPath: string): Promise<Buffer> {
    const failures: string[] = []
    for (const gateway of dependencies.gateways) {
      try {
        const response = await dependencies.fetch(`${gateway}${cidPath}`, {
          signal: AbortSignal.timeout(dependencies.timeoutMs),
        })
        if (!response.ok) {
          failures.push(`${gateway} ${response.status}`)
          continue
        }
        const declared = Number(response.headers.get('content-length'))
        if (declared > dependencies.maxImageBytes) {
          failures.push(`${gateway} too large (${declared})`)
          continue
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > dependencies.maxImageBytes) {
          failures.push(`${gateway} too large (${buffer.length})`)
          continue
        }
        return buffer
      } catch (err) {
        failures.push(`${gateway} ${(err as Error).message}`)
      }
    }
    throw new Error(`no IPFS gateway served ${cidPath}: ${failures.join(', ')}`)
  }

  // Oldest-first eviction once the folder outgrows the cap. Runs only after a
  // miss — we just spent a network round trip, a readdir costs nothing next
  // to it.
  // ponytail: FIFO by write time, not true LRU (no utimes touch on every
  // hit). The whole collection fits well under the cap, so eviction only
  // fires on junk CIDs; make it LRU if that stops being true.
  async function evict(): Promise<void> {
    const names = await fs.readdir(dependencies.cacheDir)
    const entries = []
    let total = 0
    for (const name of names) {
      try {
        const stat = await fs.stat(path.join(dependencies.cacheDir, name))
        if (!stat.isFile()) continue
        entries.push({ name, size: stat.size, mtime: stat.mtimeMs })
        total += stat.size
      } catch {
        // Raced with another eviction; nothing to account for.
      }
    }
    if (total <= dependencies.maxCacheBytes) return
    entries.sort((a, b) => a.mtime - b.mtime)
    for (const entry of entries) {
      if (total <= dependencies.maxCacheBytes) return
      try {
        await fs.rm(path.join(dependencies.cacheDir, entry.name))
        total -= entry.size
      } catch {
        // Already gone.
      }
    }
  }

  async function fetchAndStore(cidPath: string): Promise<CachedImage> {
    const buffer = await fetchFromGateways(cidPath)
    const contentType = imageContentType(buffer)
    if (!contentType) throw new Error(`${cidPath} is not an image`)
    const file = cacheFile(cidPath)
    // Write then rename so a concurrent reader never sees a partial file.
    const temporary = `${file}.${randomBytes(6).toString('hex')}`
    await fs.mkdir(dependencies.cacheDir, { recursive: true })
    await fs.writeFile(temporary, buffer)
    await fs.rename(temporary, file)
    await evict()
    return { buffer, contentType }
  }

  async function get(cidPath: string): Promise<CachedImage> {
    try {
      const buffer = await fs.readFile(cacheFile(cidPath))
      const contentType = imageContentType(buffer)
      if (contentType) return { buffer, contentType }
      // Truncated or corrupt entry — refetch it.
    } catch {
      // Cache miss.
    }
    const pending = inFlight.get(cidPath)
    if (pending) return pending
    const promise = fetchAndStore(cidPath).finally(() => inFlight.delete(cidPath))
    inFlight.set(cidPath, promise)
    return promise
  }

  // Fire-and-forget: pull images into the cache while the user is still
  // reading the screen that lists them.
  function warm(cidPaths: string[]): void {
    for (const cidPath of cidPaths) {
      if (!isValidCidPath(cidPath)) continue
      get(cidPath).catch((err: Error) =>
        dependencies.logError(`IPFS warm failed: ${err.message}`),
      )
    }
  }

  return { get, warm }
}
