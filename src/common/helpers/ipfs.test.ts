/* eslint-disable test/no-import-node-test */
import type { IPFSClientDependencies } from '#root/common/helpers/ipfs'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import {
  buildIPFSClient,
  buildIPFSGatewayLink,
} from '#root/common/helpers/ipfs'

interface FakeResponse {
  ok: boolean
  status: number
  text: () => Promise<string>
  json: () => Promise<unknown>
  arrayBuffer?: () => Promise<ArrayBuffer>
}

interface FetchCall {
  url: string
  init?: { method?: string, headers?: Record<string, string>, body?: unknown }
}

function okJSON(body: unknown): FakeResponse {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }
}

function fail(status: number, message: string): FakeResponse {
  return {
    ok: false,
    status,
    text: async () => message,
    json: async () => ({ error: message }),
  }
}

function okBytes(bytes: number[]): FakeResponse {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({}),
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  }
}

interface Harness {
  calls: FetchCall[]
  responses: FakeResponse[]
  savedImages: { username: string, filename: string, buffer: Buffer }[]
  savedJsons: { adminIndex: number, username: string, json: object }[]
}

function makeClient(overrides: Partial<IPFSClientDependencies> = {}, responses: FakeResponse[] = []) {
  const h: Harness = {
    calls: [],
    responses: [...responses],
    savedImages: [],
    savedJsons: [],
  }

  const deps: IPFSClientDependencies = {
    fetch: async (url, init) => {
      h.calls.push({ url, init })
      const next = h.responses.shift()
      if (!next) throw new Error(`No more fake responses queued for ${url}`)
      return next
    },
    pinataAuthHeaders: () => ({
      pinata_api_key: 'test-api-key',
      pinata_secret_api_key: 'test-api-secret',
    }),
    saveImage: (username, filename, buffer) => {
      h.savedImages.push({ username, filename, buffer })
      return `/tmp/${username}/${filename}`
    },
    saveJSON: (adminIndex, username, json) => {
      h.savedJsons.push({ adminIndex, username, json })
      return `/tmp/${username}/${username}_${adminIndex}.json`
    },
    ...overrides,
  }

  return { client: buildIPFSClient(deps), h }
}

// buildIPFSGatewayLink — pure URL composer

test('buildIPFSGatewayLink composes a Pinata-style gateway URL', () => {
  assert.equal(
    buildIPFSGatewayLink('https://gw.example', 'tok-123', 'QmHash'),
    'https://gw.example/ipfs/QmHash?pinataGatewayToken=tok-123',
  )
})

test('buildIPFSGatewayLink does not URL-encode the hash or token', () => {
  // The function is a verbatim template — interpolating special characters
  // produces literal output. Callers are responsible for upstream encoding.
  assert.equal(
    buildIPFSGatewayLink('g', 'k', 'a/b?c'),
    'g/ipfs/a/b?c?pinataGatewayToken=k',
  )
})

// pinImageURLToIPFS — fetch image bytes, save locally, pin to Pinata

test('pinImageURLToIPFS fetches bytes, saves locally, and returns the IpfsHash', async () => {
  const { client, h } = makeClient({}, [
    okBytes([0x89, 0x50, 0x4E, 0x47]), // PNG magic bytes
    okJSON({ IpfsHash: 'QmIMG', PinSize: 4, Timestamp: 't' }),
  ])

  const hash = await client.pinImageURLToIPFS(
    3,
    'alice',
    'https://cdn.example.com/path/avatar.png',
  )

  assert.equal(hash, 'QmIMG')
  assert.equal(h.savedImages.length, 1)
  assert.equal(h.savedImages[0].username, 'alice')
  // filename format: <username>_<adminIndex>.<ext>
  assert.equal(h.savedImages[0].filename, 'alice_3.png')
  assert.deepEqual([...h.savedImages[0].buffer], [0x89, 0x50, 0x4E, 0x47])

  // Two fetches: the image URL, then the Pinata upload
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].url, 'https://cdn.example.com/path/avatar.png')
  assert.equal(h.calls[1].url, 'https://api.pinata.cloud/pinning/pinFileToIPFS')
  assert.equal(h.calls[1].init?.method, 'POST')
  assert.equal(h.calls[1].init?.headers?.pinata_api_key, 'test-api-key')
})

test('pinImageURLToIPFS throws when Pinata returns a non-OK response', async () => {
  const { client } = makeClient({}, [
    okBytes([1, 2, 3]),
    fail(429, 'Too Many Requests'),
  ])

  await assert.rejects(
    () => client.pinImageURLToIPFS(0, 'alice', 'https://x/y.png'),
    /Pinata pinFileToIPFS failed: 429 Too Many Requests/,
  )
})

// pinJSONToIPFS — saves locally and posts JSON to Pinata

test('pinJSONToIPFS saves to disk, posts JSON, and returns the IpfsHash', async () => {
  const meta = { name: 'Citizen #1', attributes: [{ k: 'v' }] }
  const { client, h } = makeClient({}, [
    okJSON({ IpfsHash: 'QmJSON', PinSize: 100, Timestamp: 't' }),
  ])

  const hash = await client.pinJSONToIPFS(7, 'bob', meta)

  assert.equal(hash, 'QmJSON')
  assert.deepEqual(h.savedJsons, [{ adminIndex: 7, username: 'bob', json: meta }])
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, 'https://api.pinata.cloud/pinning/pinJSONToIPFS')
  assert.equal(h.calls[0].init?.method, 'POST')
  assert.equal(h.calls[0].init?.headers?.['Content-Type'], 'application/json')

  const body = JSON.parse(h.calls[0].init?.body as string)
  assert.deepEqual(body.pinataContent, meta)
  assert.equal(body.pinataMetadata.name, 'bob_7.json')
})

test('pinJSONToIPFS throws when Pinata returns a non-OK response', async () => {
  const { client } = makeClient({}, [fail(500, 'Internal Server Error')])

  await assert.rejects(
    () => client.pinJSONToIPFS(0, 'alice', { foo: 'bar' }),
    /Pinata pinJSONToIPFS failed: 500 Internal Server Error/,
  )
})

// unpin — DELETE request to Pinata

test('unpin sends a DELETE with the hash and auth headers', async () => {
  const { client, h } = makeClient({}, [okJSON({})])

  await client.unpin('QmDelete')

  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, 'https://api.pinata.cloud/pinning/unpin/QmDelete')
  assert.equal(h.calls[0].init?.method, 'DELETE')
  assert.equal(h.calls[0].init?.headers?.pinata_api_key, 'test-api-key')
  assert.equal(h.calls[0].init?.headers?.pinata_secret_api_key, 'test-api-secret')
})

test('unpin throws when Pinata returns a non-OK response', async () => {
  const { client } = makeClient({}, [fail(404, 'Not Found')])

  await assert.rejects(
    () => client.unpin('QmMissing'),
    /Pinata unpin failed: 404 Not Found/,
  )
})

// pinFileToIPFS — direct buffer pinning (exercised via the returned helper)

test('pinFileToIPFS posts multipart form data and returns the response', async () => {
  const { client, h } = makeClient({}, [
    okJSON({ IpfsHash: 'QmBytes', PinSize: 3, Timestamp: 't' }),
  ])

  const response = await client.pinFileToIPFS(Buffer.from([1, 2, 3]), 'image.png')

  assert.equal(response.IpfsHash, 'QmBytes')
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, 'https://api.pinata.cloud/pinning/pinFileToIPFS')
  assert.equal(h.calls[0].init?.method, 'POST')
  // FormData sets a multipart content-type with a boundary
  assert.match(
    h.calls[0].init?.headers?.['content-type'] ?? '',
    /^multipart\/form-data; boundary=/,
  )
})

test('pinFileToIPFS throws when Pinata returns a non-OK response', async () => {
  const { client } = makeClient({}, [fail(401, 'Unauthorized')])

  await assert.rejects(
    () => client.pinFileToIPFS(Buffer.from([0]), 'x.bin'),
    /Pinata pinFileToIPFS failed: 401 Unauthorized/,
  )
})
