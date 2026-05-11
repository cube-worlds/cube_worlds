/* eslint-disable test/no-import-node-test */
import type { ImageGeneratorDependencies } from '#root/common/helpers/generation'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import {
  buildImageGenerator,
  ClipGuidancePreset,
  SDSampler,
} from '#root/common/helpers/generation'

interface FakeResponse {
  ok: boolean
  text: () => Promise<string>
  json: () => Promise<unknown>
}

function okJSON(body: unknown): FakeResponse {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }
}

function fail(message: string): FakeResponse {
  return {
    ok: false,
    text: async () => message,
    json: async () => ({ error: message }),
  }
}

interface Harness {
  fetchCalls: { url: string, init: { method: string, headers: Record<string, string>, body: unknown } }[]
  reads: string[]
  writes: { path: string, bytes: number[] }[]
  errors: string[]
}

function makeGenerator(
  overrides: Partial<ImageGeneratorDependencies> = {},
  responses: FakeResponse[] = [],
) {
  const h: Harness = {
    fetchCalls: [],
    reads: [],
    writes: [],
    errors: [],
  }
  const queue = [...responses]

  const deps: ImageGeneratorDependencies = {
    fetch: async (url, init) => {
      h.fetchCalls.push({ url, init })
      const next = queue.shift()
      if (!next) throw new Error(`No more fake responses queued for ${url}`)
      return next
    },
    readFileSync: (filePath) => {
      h.reads.push(filePath)
      return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG magic
    },
    writeFileSync: (filePath, data) => {
      h.writes.push({ path: filePath, bytes: [...data] })
    },
    resolveOutputPath: (username, adminIndex) => `/tmp/${username}/${username}_${adminIndex}.png`,
    apiKey: () => 'sk-test-key',
    errorLog: (msg) => { h.errors.push(msg) },
    ...overrides,
  }

  return { generator: buildImageGenerator(deps), h }
}

function args() {
  return [
    '/init.jpg',
    7,
    'alice',
    'positive prompt',
    'negative prompt',
    0.35,
    7,
    30,
    ClipGuidancePreset.NONE,
    SDSampler.K_DPMPP_2S_ANCESTRAL,
  ] as const
}

// API-key guard

test('generate throws when Stability API key is missing', async () => {
  const { generator } = makeGenerator({ apiKey: () => undefined })

  await assert.rejects(
    () => generator.generate(...args()),
    /Missing Stability API key/,
  )
})

test('generate throws when Stability API key is the empty string', async () => {
  const { generator } = makeGenerator({ apiKey: () => '' })

  await assert.rejects(
    () => generator.generate(...args()),
    /Missing Stability API key/,
  )
})

// Happy path

test('generate writes the decoded image to the resolved path and returns it', async () => {
  // The base64 below decodes to [1, 2, 3, 4]
  const { generator, h } = makeGenerator({}, [
    okJSON({ artifacts: [{ base64: 'AQIDBA==', seed: 42, finishReason: 'SUCCESS' }] }),
  ])

  const result = await generator.generate(...args())

  assert.equal(result, '/tmp/alice/alice_7.png')
  assert.equal(h.writes.length, 1)
  assert.equal(h.writes[0].path, '/tmp/alice/alice_7.png')
  assert.deepEqual(h.writes[0].bytes, [1, 2, 3, 4])
  assert.deepEqual(h.reads, ['/init.jpg'])
})

test('generate posts to Stability /image-to-image with bearer auth and form-data headers', async () => {
  const { generator, h } = makeGenerator({}, [
    okJSON({ artifacts: [{ base64: '', seed: 0, finishReason: 'SUCCESS' }] }),
  ])

  await generator.generate(...args())

  assert.equal(h.fetchCalls.length, 1)
  const call = h.fetchCalls[0]
  assert.equal(
    call.url,
    'https://api.stability.ai/v1/generation/stable-diffusion-v1-6/image-to-image',
  )
  assert.equal(call.init.method, 'POST')
  assert.equal(call.init.headers.Authorization, 'Bearer sk-test-key')
  assert.equal(call.init.headers.Accept, 'application/json')
  // FormData sets a multipart content-type with a boundary
  assert.match(call.init.headers['content-type'] ?? '', /^multipart\/form-data; boundary=/)
})

// Failure paths

test('generate throws "Non-200 response" when Stability returns a failure status', async () => {
  const { generator } = makeGenerator({}, [fail('Internal Server Error')])

  await assert.rejects(
    () => generator.generate(...args()),
    /Non-200 response: Internal Server Error/,
  )
})

test('generate surfaces the artifact.finishReason as the error when it is not SUCCESS', async () => {
  const { generator, h } = makeGenerator({}, [
    okJSON({ artifacts: [{ base64: 'AQ==', seed: 0, finishReason: 'CONTENT_FILTERED' }] }),
  ])

  await assert.rejects(
    () => generator.generate(...args()),
    /CONTENT_FILTERED/,
  )
  // No file written on failure
  assert.equal(h.writes.length, 0)
})

test('generate throws "Unknown generation error" when the artifact has no finishReason', async () => {
  const { generator, h } = makeGenerator({}, [
    okJSON({ artifacts: [{ base64: 'AQ==', seed: 0 }] }),
  ])

  await assert.rejects(
    () => generator.generate(...args()),
    /Unknown generation error/,
  )
  assert.equal(h.errors.length, 1)
  assert.match(h.errors[0], /Unknown generation error/)
})
