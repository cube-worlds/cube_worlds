import type { Pass } from './login-payload'
import type { NftItemsResponse } from './pass-handler'
import { findUserById, setUserPass } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildPassHandler, MAX_PASSES, parseNftItems } from './pass-handler'

const TONCENTER = config.TESTNET
  ? 'https://testnet.toncenter.com'
  : 'https://toncenter.com'

// Cube Worlds NFTs held by `ownerAddress` via toncenter v3 (already filtered
// by collection server-side). Throws on any HTTP/network failure — callers
// decide whether that is fatal (scan) or ignorable (login revalidation).
export async function listPassesFromToncenter(ownerAddress: string): Promise<Pass[]> {
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

export function createPassHandler() {
  return buildPassHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    listPasses: listPassesFromToncenter,
    setUserPass,
    logError: (message) => logger.error(message),
  })
}
