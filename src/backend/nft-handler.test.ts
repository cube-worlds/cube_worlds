/* eslint-disable test/no-import-node-test */
import type { NftData, NftHandlerDependencies } from '#root/backend/nft-handler'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { buildNftHandler, nftImage, toJSON } from '#root/backend/nft-handler'
import { CNFTImageType } from '#root/common/models/CNFT'
import fastify from 'fastify'

interface Harness {
  app: ReturnType<typeof fastify>
  byWallet: Map<string, NftData>
  walletThrowsFor: Set<string>
  byIndex: Map<number, NftData>
  renderCalls: { imageName: string, color: number }[]
  renderResult: Buffer
  infoCalls: unknown[][]
}

function makeHarness(overrides: Partial<NftHandlerDependencies> = {}): Harness {
  const h: Harness = {
    app: fastify(),
    byWallet: new Map(),
    walletThrowsFor: new Set(),
    byIndex: new Map(),
    renderCalls: [],
    renderResult: Buffer.from([0x52, 0x49, 0x46, 0x46]), // "RIFF" prefix as a stand-in
    infoCalls: [],
  }

  const deps: NftHandlerDependencies = {
    findByWallet: async (address) => {
      if (h.walletThrowsFor.has(address)) {
        throw new Error('Invalid address')
      }
      return h.byWallet.get(address) ?? null
    },
    findByIndex: async (index) => h.byIndex.get(index) ?? null,
    renderImage: async (imageName, color) => {
      h.renderCalls.push({ imageName, color })
      return h.renderResult
    },
    info: (...args) => {
      h.infoCalls.push(args)
    },
    ...overrides,
  }

  void h.app.register(buildNftHandler(deps))
  return h
}

// /collection.json

test('GET /collection.json returns the static collection metadata', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/collection.json' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.name, 'Cube Worlds Citizens')
  assert.equal(body.image, 'https://cubeworlds.club/avatar.png')
  assert.equal(body.marketplace, 'getgems.io')
  assert.equal(body.cover_image, 'https://cubeworlds.club/background.png')
  assert.deepEqual(body.social_links, [
    'https://t.me/cube_worlds_bot',
    'https://twitter.com/cube_worlds',
  ])
})

// /:address

test('GET /:address returns 404 when no NFT is bound to the wallet', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/UQabcdefghi' })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.json(), { error: 'NFT not found' })
})

test('GET /:address returns 400 when address parsing throws', async () => {
  const h = makeHarness()
  h.walletThrowsFor.add('not-a-valid-address')
  const res = await h.app.inject({
    method: 'GET',
    url: '/not-a-valid-address',
  })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid address format' })
})

test('GET /:address returns the NFT JSON when found', async () => {
  const h = makeHarness()
  h.byWallet.set('UQwallet', {
    index: 42,
    type: CNFTImageType.Whale,
    color: 5,
  })
  const res = await h.app.inject({ method: 'GET', url: '/UQwallet' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.name, 'Cube Worlds Citizen #42')
  assert.equal(body.image, 'https://cubeworlds.club/api/nft/whale-5.webp')
  assert.deepEqual(body.attributes, [
    { trait_type: 'Type', value: 'Whale' },
    { trait_type: 'Color', value: 5 },
  ])
  assert.deepEqual(body.buttons, [
    { label: 'Explore Cube Worlds', uri: 'https://t.me/cube_worlds_bot' },
  ])
})

// /:index.json

test('GET /:index.json rejects non-integer index', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/abc.json' })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid index' })
})

test('GET /:index.json rejects negative index', async () => {
  const h = makeHarness()
  // Note: `/-1.json` is parsed by the route; Number('-1') = -1 → invalid
  const res = await h.app.inject({ method: 'GET', url: '/-1.json' })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid index' })
})

test('GET /:index.json returns 404 when index does not exist', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/999.json' })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.json(), { error: 'NFT not found' })
})

test('GET /:index.json returns NFT JSON when index exists', async () => {
  const h = makeHarness()
  h.byIndex.set(7, { index: 7, type: CNFTImageType.Common, color: 0 })
  const res = await h.app.inject({ method: 'GET', url: '/7.json' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.name, 'Cube Worlds Citizen #7')
  assert.equal(body.image, 'https://cubeworlds.club/api/nft/common-0.webp')
})

// /:image-:color.webp

test('GET /:image-:color.webp rejects invalid image type', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/wizard-3.webp' })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid image type' })
  assert.equal(h.renderCalls.length, 0)
})

test('GET /:image-:color.webp rejects color above 10', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/whale-11.webp' })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid color value' })
  assert.equal(h.renderCalls.length, 0)
})

test('GET /:image-:color.webp rejects non-integer color', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/whale-abc.webp' })
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.json(), { error: 'Invalid color value' })
})

test('GET /:image-:color.webp renders WebP with correct headers and image name', async () => {
  const h = makeHarness()
  const res = await h.app.inject({ method: 'GET', url: '/whale-3.webp' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'image/webp')
  assert.equal(res.headers['content-length'], String(h.renderResult.length))
  assert.deepEqual(res.rawPayload, h.renderResult)
  assert.deepEqual(h.renderCalls, [{ imageName: 'whale', color: 3 }])
})

test('GET /:image-:color.webp lowercases imageName for each CNFT type', async () => {
  for (const [typeKey, expectedImageName] of [
    ['Dice', 'dice'],
    ['Whale', 'whale'],
    ['Diamond', 'diamond'],
    ['Coin', 'coin'],
    ['Knight', 'knight'],
    ['Common', 'common'],
  ] as const) {
    const h = makeHarness()
    const res = await h.app.inject({
      method: 'GET',
      url: `/${typeKey.toLowerCase()}-0.webp`,
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(h.renderCalls, [{ imageName: expectedImageName, color: 0 }])
  }
})

test('GET /:image-:color.webp accepts color boundaries 0 and 10', async () => {
  for (const color of [0, 10]) {
    const h = makeHarness()
    const res = await h.app.inject({
      method: 'GET',
      url: `/whale-${color}.webp`,
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(h.renderCalls, [{ imageName: 'whale', color }])
  }
})

// nftImage — CNFTImageType → image basename mapping

test('nftImage maps every CNFTImageType to its lowercase image name', () => {
  assert.equal(nftImage(CNFTImageType.Dice), 'dice')
  assert.equal(nftImage(CNFTImageType.Whale), 'whale')
  assert.equal(nftImage(CNFTImageType.Diamond), 'diamond')
  assert.equal(nftImage(CNFTImageType.Coin), 'coin')
  assert.equal(nftImage(CNFTImageType.Knight), 'knight')
  assert.equal(nftImage(CNFTImageType.Common), 'common')
})

test('nftImage falls back to "common" for unknown values', () => {
  // Belt-and-braces: an enum value that drops through every check
  assert.equal(nftImage('SomethingNew' as CNFTImageType), 'common')
})

// toJSON — NFT metadata shape (TON NFT spec)

test('toJSON produces the documented metadata shape', () => {
  const json = toJSON({ index: 7, type: CNFTImageType.Whale, color: 3 })
  assert.equal(json.name, 'Cube Worlds Citizen #7')
  assert.equal(
    json.description,
    'Thank you for your participation in the Cube Worlds Project!',
  )
  assert.equal(
    json.image,
    'https://cubeworlds.club/api/nft/whale-3.webp',
  )
  assert.deepEqual(json.attributes, [
    { trait_type: 'Type', value: CNFTImageType.Whale },
    { trait_type: 'Color', value: 3 },
  ])
  assert.deepEqual(json.buttons, [
    { label: 'Explore Cube Worlds', uri: 'https://t.me/cube_worlds_bot' },
  ])
})

test('toJSON image url lowercases the type name', () => {
  // Type values are PascalCase but the static image filenames are lowercase.
  // This was a regression-prone spot before the lowercase() was added.
  for (const type of [
    CNFTImageType.Dice,
    CNFTImageType.Whale,
    CNFTImageType.Diamond,
    CNFTImageType.Coin,
    CNFTImageType.Knight,
    CNFTImageType.Common,
  ]) {
    const json = toJSON({ index: 0, type, color: 0 })
    assert.match(json.image, /\/[a-z]+-0\.webp$/)
  }
})

test('toJSON includes index in the name verbatim (no formatting)', () => {
  assert.equal(toJSON({ index: 0, type: CNFTImageType.Common, color: 0 }).name, 'Cube Worlds Citizen #0')
  assert.equal(toJSON({ index: 9999, type: CNFTImageType.Common, color: 0 }).name, 'Cube Worlds Citizen #9999')
})
