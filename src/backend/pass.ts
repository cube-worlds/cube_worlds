import type { Pass } from './login-payload'
import type { NftItemsResponse } from './pass-handler'
import { Address } from '@ton/core'
import { findUserById, setUserPass } from '#root/common/models/User'
import { config } from '#root/config'
import { parseTraits } from '#root/game/traits'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
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

// Single-item ownership check for revalidation — unlike listPassesFromToncenter
// (capped at MAX_PASSES for the scan picker), this must work for wallets
// holding more than MAX_PASSES Cube Worlds NFTs.
export async function verifyPassOwnership(passAddress: string, ownerAddress: string): Promise<boolean> {
  const TONCENTER = config.TESTNET
    ? 'https://testnet.toncenter.com'
    : 'https://toncenter.com'
  const url = new URL(`${TONCENTER}/api/v3/nft/items`)
  url.searchParams.set('address', passAddress)
  const response = await fetch(url, {
    headers: { 'X-Api-Key': config.TONCENTER_API_KEY },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`toncenter nft/items ${response.status}`)
  }
  const body = (await response.json()) as NftItemsResponse
  const item = body.nft_items[0]
  if (!item?.owner_address) return false
  return Address.parse(item.owner_address).toString({ bounceable: true }) === ownerAddress
}

const PUBLIC_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

// The item content JSON holds the 120 personality traits under `attributes`.
export async function fetchTraitsFromContent(contentUri: string): Promise<Record<string, number>> {
  const url = contentUri.startsWith('ipfs://')
    ? `${PUBLIC_IPFS_GATEWAY}${contentUri.slice('ipfs://'.length)}`
    : contentUri
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`content json ${response.status}`)
  const json = (await response.json()) as { attributes?: unknown }
  return parseTraits(json.attributes)
}

export function createPassHandler() {
  return buildPassHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    listPasses: listPassesFromToncenter,
    setUserPass,
    logError: (message) => logger.error(message),
    fetchTraits: fetchTraitsFromContent,
  })
}
