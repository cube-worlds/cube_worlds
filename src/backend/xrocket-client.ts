import type { FetchLike, XRocketClient } from '#root/common/helpers/xrocket'
import fetch from 'node-fetch'
import { buildXRocketClient } from '#root/common/helpers/xrocket'
import { config } from '#root/config'

// node-fetch's signature is structurally compatible with FetchLike for our use.
const xrocketClient: XRocketClient = buildXRocketClient({
  fetch: fetch as unknown as FetchLike,
  apiKey: config.XROCKET_API_KEY,
  baseUrl: config.XROCKET_BASE_URL,
})

export function isMoneyRailEnabled(): boolean {
  return config.XROCKET_API_KEY.length > 0
}

export { xrocketClient }

export default xrocketClient
