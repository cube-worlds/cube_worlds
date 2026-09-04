/* eslint-disable test/no-import-node-test */
import type { IpfsCacheDependencies } from '#root/backend/ipfs-cache'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildIpfsCache, imageContentType, isValidCidPath } from '#root/backend/ipfs-cache'

const PNG = Buffer.concat([Buffer.from('\x89PNG\r\n\x1A\n', 'latin1'), Buffer.alloc(64, 1)])
const JPEG = Buffer.concat([Buffer.from('\xFF\xD8\xFF\xE0', 'latin1'), Buffer.alloc(64, 2)])
const NOT_AN_IMAGE = Buffer.from('<!doctype html><html>429 Too Many Requests</html>')

interface Harness {
  cache: ReturnType<typeof buildIpfsCache>
  dir: string
  calls: string[]
  errors: string[]
}

function bytes(body: Buffer): Promise<ArrayBuffer> {
  return Promise.resolve(new Uint8Array(body).buffer as ArrayBuffer)
}

function ok(body: Buffer) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name === 'content-length' ? String(body.length) : null) },
    arrayBuffer: () => bytes(body),
  }
}

function fail(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(0),
  }
}

// warm() is fire-and-forget; give its promise chain (fetch → write → evict)
// a few turns of the loop to land.
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

async function createHarness(
  overrides: Partial<IpfsCacheDependencies> = {},
): Promise<Harness> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cw-ipfs-'))
  const calls: string[] = []
  const errors: string[] = []
  const cache = buildIpfsCache({
    fetch: async (url) => {
      calls.push(url)
      return ok(PNG)
    },
    gateways: ['https://gw-a/ipfs/'],
    cacheDir: dir,
    maxImageBytes: 1024,
    maxCacheBytes: 10_000,
    timeoutMs: 1000,
    logError: (message) => errors.push(message),
    ...overrides,
  })
  return { cache, dir, calls, errors }
}

test('isValidCidPath accepts CIDs and inner paths, rejects everything else', () => {
  assert.ok(isValidCidPath('QmImg'))
  assert.ok(isValidCidPath('QmImg/pic.png'))
  assert.ok(!isValidCidPath('../../etc/passwd'))
  assert.ok(!isValidCidPath('/etc/passwd'))
  assert.ok(!isValidCidPath('QmImg/../../etc/passwd'))
  assert.ok(!isValidCidPath('https://evil.example/x'))
  assert.ok(!isValidCidPath('QmImg?x=1'))
  assert.ok(!isValidCidPath(''))
  assert.ok(!isValidCidPath(undefined))
  assert.ok(!isValidCidPath('Q'.repeat(201)))
})

test('imageContentType reads magic bytes, not the gateway claim', () => {
  assert.equal(imageContentType(PNG), 'image/png')
  assert.equal(imageContentType(JPEG), 'image/jpeg')
  assert.equal(imageContentType(NOT_AN_IMAGE), null)
})

test('get fetches once, then serves from disk', async (t) => {
  const h = await createHarness()
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  const first = await h.cache.get('QmImg')
  assert.equal(first.contentType, 'image/png')
  assert.deepEqual(first.buffer, PNG)
  assert.deepEqual(h.calls, ['https://gw-a/ipfs/QmImg'])

  const second = await h.cache.get('QmImg')
  assert.deepEqual(second.buffer, PNG)
  assert.equal(h.calls.length, 1, 'second get must not hit a gateway')
  assert.deepEqual(await fs.readdir(h.dir), ['QmImg'])
})

test('get falls through to the next gateway when one fails', async (t) => {
  const h = await createHarness({
    gateways: ['https://gw-a/ipfs/', 'https://gw-b/ipfs/'],
    fetch: async (url) => (url.startsWith('https://gw-a') ? fail(429) : ok(JPEG)),
  })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  const image = await h.cache.get('QmImg')
  assert.equal(image.contentType, 'image/jpeg')
})

test('get throws when every gateway fails, and caches nothing', async (t) => {
  const h = await createHarness({
    gateways: ['https://gw-a/ipfs/', 'https://gw-b/ipfs/'],
    fetch: async () => fail(429),
  })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await assert.rejects(h.cache.get('QmImg'), /no IPFS gateway served QmImg.*429.*429/s)
  assert.deepEqual(await fs.readdir(h.dir), [])
})

test('get refuses a non-image payload (gateway error pages, arbitrary blobs)', async (t) => {
  const h = await createHarness({ fetch: async () => ok(NOT_AN_IMAGE) })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await assert.rejects(h.cache.get('QmImg'), /not an image/)
  assert.deepEqual(await fs.readdir(h.dir), [])
})

test('get skips a response over the per-file cap, by header and by body', async (t) => {
  const huge = Buffer.concat([PNG, Buffer.alloc(2048)])
  // No content-length header: the cap has to hold on the body too.
  const lying = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    arrayBuffer: () => bytes(huge),
  }
  const h = await createHarness({
    gateways: ['https://gw-a/ipfs/', 'https://gw-b/ipfs/'],
    fetch: async (url) => (url.startsWith('https://gw-a') ? ok(huge) : lying),
  })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await assert.rejects(h.cache.get('QmBig'), /too large.*too large/s)
  assert.deepEqual(await fs.readdir(h.dir), [])
})

test('concurrent gets for the same CID share one fetch', async (t) => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const fetches: string[] = []
  const h = await createHarness({
    fetch: async (url) => {
      fetches.push(url)
      await gate
      return ok(PNG)
    },
  })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  const all = Promise.all([
    h.cache.get('QmImg'),
    h.cache.get('QmImg'),
    h.cache.get('QmImg'),
  ])
  release()
  const results = await all
  assert.equal(fetches.length, 1, 'three concurrent gets must share one fetch')
  for (const result of results) assert.deepEqual(result.buffer, PNG)

  // The in-flight entry is released, so a later miss still fetches.
  await h.cache.get('QmOther')
  assert.equal(fetches.length, 2)
})

test('the cache evicts oldest entries once it outgrows the cap', async (t) => {
  const body = Buffer.concat([PNG, Buffer.alloc(400)])
  const h = await createHarness({
    maxImageBytes: 4096,
    maxCacheBytes: 1200, // fits two entries of ~472 bytes, not three
    fetch: async () => ok(body),
  })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await h.cache.get('QmOld')
  // mtime has millisecond resolution — make the ordering explicit.
  const old = new Date(Date.now() - 60_000)
  await fs.utimes(path.join(h.dir, 'QmOld'), old, old)
  await h.cache.get('QmMid')
  await h.cache.get('QmNew')

  const left = (await fs.readdir(h.dir)).sort()
  assert.deepEqual(left, ['QmMid', 'QmNew'], 'oldest entry evicted')
})

test('a truncated cache entry is refetched instead of served', async (t) => {
  const h = await createHarness()
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await fs.writeFile(path.join(h.dir, 'QmImg'), Buffer.alloc(4))
  const image = await h.cache.get('QmImg')
  assert.equal(image.contentType, 'image/png')
  assert.equal(h.calls.length, 1)
})

test('warm pulls images in the background and swallows failures', async (t) => {
  const h = await createHarness({ fetch: async () => fail(500) })
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  h.cache.warm(['QmA', '', '../escape'])
  await settle()
  assert.equal(h.errors.length, 1, 'only the valid CID is attempted')
  assert.match(h.errors[0], /IPFS warm failed.*QmA/)
})

test('warm caches what a later get would have fetched', async (t) => {
  const h = await createHarness()
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  h.cache.warm(['QmImg'])
  await settle()
  const image = await h.cache.get('QmImg')
  assert.deepEqual(image.buffer, PNG)
  assert.equal(h.calls.length, 1, 'warm already paid for the fetch')
})

test('cache entries never escape the cache folder', async (t) => {
  const h = await createHarness()
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  // The route rejects these, but the filename must be safe regardless.
  await h.cache.get('QmImg/deep/pic.png')
  const names = await fs.readdir(h.dir)
  assert.deepEqual(names, ['QmImg_deep_pic.png'])
  assert.ok(!names.some((name) => name.includes('/')))
})

test('writes land under the final name, leaving no temp files behind', async (t) => {
  const h = await createHarness()
  t.after(() => fs.rm(h.dir, { recursive: true, force: true }))

  await Promise.all([h.cache.get('QmA'), h.cache.get('QmB')])
  assert.deepEqual((await fs.readdir(h.dir)).sort(), ['QmA', 'QmB'])
})
