import type { FastifyInstance } from 'fastify'
import type { Pass } from './login-payload'
import type { NftItemsResponse } from './pass-handler'
import { Address } from '@ton/core'
import { folderPath } from '#root/common/helpers/files'
import { findUserById, setUserPass } from '#root/common/models/User'
import { config } from '#root/config'
import { parseTraits } from '#root/game/traits'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import {
  buildIpfsCache,
  IPFS_CACHE_FOLDER,
  isValidCidPath,
  MAX_CACHE_BYTES,
  MAX_IMAGE_BYTES,
} from './ipfs-cache'
import { passImageCidPath } from './login-payload'
import { buildPassHandler, MAX_PASSES, parseNftItems } from './pass-handler'

// Cube Worlds NFTs held by `ownerAddress` via toncenter v3 (already filtered
// by collection server-side). Throws on any HTTP/network failure — callers
// decide whether that is fatal (scan) or ignorable (login revalidation).
// `config` reads happen lazily inside the function — a module-level read
// would eagerly run env validation on import (auth-handler.ts pulls this in
// as its default dependency, and its tests must not transitively touch
// #root/config).
export async function listPassesFromToncenter(ownerAddress: string): Promise<Pass[]> {
  const TONCENTER = config.TESTNET
    ? 'https://testnet.toncenter.com'
    : 'https://toncenter.com'
  const url = new URL(`${TONCENTER}/api/v3/nft/items`)
  url.searchParams.set('owner_address', ownerAddress)
  url.searchParams.set('collection_address', config.COLLECTION_ADDRESS)
  url.searchParams.set('limit', String(MAX_PASSES))
  const response = await fetch(url, {
    headers: { 'X-Api-Key': config.TONCENTER_API_KEY },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`toncenter nft/items ${response.status}`)
  }
  return parseNftItems((await response.json()) as NftItemsResponse)
}

// Single-item lookup by address — unlike listPassesFromToncenter (capped at
// MAX_PASSES for the scan picker), this must work for wallets holding more
// than MAX_PASSES Cube Worlds NFTs.
async function fetchNftItem(passAddress: string): Promise<NftItemsResponse['nft_items'][0] | undefined> {
  const TONCENTER = config.TESTNET
    ? 'https://testnet.toncenter.com'
    : 'https://toncenter.com'
  const url = new URL(`${TONCENTER}/api/v3/nft/items`)
  url.searchParams.set('address', passAddress)
  const response = await fetch(url, {
    headers: { 'X-Api-Key': config.TONCENTER_API_KEY },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`toncenter nft/items ${response.status}`)
  const body = (await response.json()) as NftItemsResponse
  return body.nft_items[0]
}

export async function verifyPassOwnership(passAddress: string, ownerAddress: string): Promise<boolean> {
  const item = await fetchNftItem(passAddress)
  if (!item?.owner_address) return false
  return Address.parse(item.owner_address).toString({ bounceable: true }) === ownerAddress
}

// Gateways in fallback order — the first one that answers wins. Any single
// one of them will 429 under real traffic, which is why nothing (browser or
// server) may depend on one gateway alone.
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

// The item content JSON holds the 120 personality traits under `attributes`.
export async function fetchTraitsFromContent(contentUri: string): Promise<Record<string, number>> {
  if (!contentUri.startsWith('ipfs://') && !contentUri.startsWith('https://')) {
    throw new Error('unsupported content uri scheme')
  }
  const urls = contentUri.startsWith('ipfs://')
    ? IPFS_GATEWAYS.map((gateway) => `${gateway}${contentUri.slice('ipfs://'.length)}`)
    : [contentUri]
  const failures: string[] = []
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        failures.push(`${url} ${response.status}`)
        continue
      }
      const json = (await response.json()) as { attributes?: unknown }
      return parseTraits(json.attributes)
    } catch (err) {
      failures.push(`${url} ${(err as Error).message}`)
    }
  }
  throw new Error(`content json unreachable: ${failures.join(', ')}`)
}

// Backfill for passes selected before Bali: item → content uri → traits.
export async function loadTraitsForPassAddress(passAddress: string): Promise<Record<string, number>> {
  const item = await fetchNftItem(passAddress)
  const uri = item?.content?.uri
  if (!uri) throw new Error('pass has no content uri')
  return fetchTraitsFromContent(uri)
}

function createIpfsCache() {
  return buildIpfsCache({
    fetch,
    gateways: IPFS_GATEWAYS,
    // folderPath() creates ./data/ipfs and guards it against traversal.
    cacheDir: folderPath(IPFS_CACHE_FOLDER),
    maxImageBytes: MAX_IMAGE_BYTES,
    maxCacheBytes: MAX_CACHE_BYTES,
    timeoutMs: 15_000,
    logError: (message) => logger.error(message),
  })
}

export function createPassHandler() {
  const cache = createIpfsCache()
  // Every screen that lists passes renders their images right away, so pull
  // them into the cache as the response goes out instead of making the first
  // <img> wait on a cold gateway.
  const listAndWarmPasses = async (ownerAddress: string): Promise<Pass[]> => {
    const passes = await listPassesFromToncenter(ownerAddress)
    cache.warm(passes.map((pass) => passImageCidPath(pass.image) ?? ''))
    return passes
  }

  const passRoutes = buildPassHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    listPasses: listAndWarmPasses,
    setUserPass,
    logError: (message) => logger.error(message),
    fetchTraits: fetchTraitsFromContent,
  })

  return async function passPlugin(fastify: FastifyInstance) {
    await fastify.register(passRoutes)

    fastify.get<{ Params: { '*': string } }>('/image/*', async (request, reply) => {
      const cidPath = request.params['*']
      if (!isValidCidPath(cidPath)) {
        return reply.code(400).send({ error: 'Invalid image path' })
      }
      try {
        const { buffer, contentType } = await cache.get(cidPath)
        return reply
          .type(contentType)
          .header('cache-control', 'public, max-age=31536000, immutable')
          .send(buffer)
      } catch (err) {
        logger.error(`IPFS image fetch failed: ${(err as Error).message}`)
        return reply.code(502).send({ error: 'Image unavailable' })
      }
    })
  }
}
