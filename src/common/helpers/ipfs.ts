import { Buffer } from 'node:buffer'
import { saveImage, saveJSON } from '#root/common/helpers/files'
import { config } from '#root/config'
import { logger } from '#root/logger'
import FormData from 'form-data'
import fetch from 'node-fetch'

const PINATA_API_BASE = 'https://api.pinata.cloud'

interface PinResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

interface MinimalResponse {
  ok: boolean
  status: number
  text: () => Promise<string>
  json: () => Promise<unknown>
}

export interface IPFSClientDependencies {
  fetch: (
    url: string,
    init?: {
      method?: string
      headers?: Record<string, string>
      body?: unknown
      signal?: AbortSignal
    },
  ) => Promise<MinimalResponse>
  pinataAuthHeaders: () => Record<string, string>
  saveImage: (username: string, filename: string, buffer: Buffer) => string
  saveJSON: (adminIndex: number, username: string, json: object) => string
  warmGateways: () => string[]
  debugLog: (message: string) => void
}

const DEFAULT_WARM_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.eth.aragon.network/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.eth.aragon.network/ipfs/',
]

function createDefaultIPFSDependencies(): IPFSClientDependencies {
  return {
    fetch: fetch as unknown as IPFSClientDependencies['fetch'],
    pinataAuthHeaders: () => ({
      pinata_api_key: config.PINATA_API_KEY,
      pinata_secret_api_key: config.PINATA_API_SECRET,
    }),
    saveImage,
    saveJSON,
    warmGateways: () => DEFAULT_WARM_GATEWAYS,
    debugLog: (message) => logger.debug(message),
  }
}

export function buildIPFSGatewayLink(
  gateway: string,
  gatewayKey: string,
  hash: string,
): string {
  return `${gateway}/ipfs/${hash}?pinataGatewayToken=${gatewayKey}`
}

export function buildIPFSClient(
  dependencies: IPFSClientDependencies = createDefaultIPFSDependencies(),
) {
  async function pinFileToIPFS(
    buffer: Buffer,
    filename: string,
  ): Promise<PinResponse> {
    const form = new FormData()
    form.append('file', buffer, { filename })
    form.append('pinataMetadata', JSON.stringify({ name: filename }))

    const response = await dependencies.fetch(
      `${PINATA_API_BASE}/pinning/pinFileToIPFS`,
      {
        method: 'POST',
        headers: { ...form.getHeaders(), ...dependencies.pinataAuthHeaders() },
        body: form,
      },
    )
    if (!response.ok) {
      throw new Error(
        `Pinata pinFileToIPFS failed: ${response.status} ${await response.text()}`,
      )
    }
    return (await response.json()) as PinResponse
  }

  async function pinImageURLToIPFS(
    adminIndex: number,
    username: string,
    imageURL: string,
  ): Promise<string> {
    const image = await dependencies.fetch(imageURL)
    const arrayBuffer = await (image as unknown as { arrayBuffer: () => Promise<ArrayBuffer> })
      .arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const imageFileName =
      imageURL.slice((imageURL.lastIndexOf('/') ?? 0) + 1) ?? ''
    const fileExtension = imageFileName.split('.').pop()
    const newFileName = `${username}_${adminIndex}.${fileExtension}`
    dependencies.saveImage(username, newFileName, buffer)

    const response = await pinFileToIPFS(buffer, newFileName)
    return response.IpfsHash
  }

  async function pinJSONToIPFS(
    adminIndex: number,
    username: string,
    json: object,
  ): Promise<string> {
    dependencies.saveJSON(adminIndex, username, json)
    const filename = `${username}_${adminIndex}.json`

    const response = await dependencies.fetch(
      `${PINATA_API_BASE}/pinning/pinJSONToIPFS`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...dependencies.pinataAuthHeaders(),
        },
        body: JSON.stringify({
          pinataContent: json,
          pinataMetadata: { name: filename },
        }),
      },
    )
    if (!response.ok) {
      throw new Error(
        `Pinata pinJSONToIPFS failed: ${response.status} ${await response.text()}`,
      )
    }
    const body = (await response.json()) as PinResponse
    return body.IpfsHash
  }

  async function unpin(hash: string): Promise<void> {
    const response = await dependencies.fetch(
      `${PINATA_API_BASE}/pinning/unpin/${hash}`,
      {
        method: 'DELETE',
        headers: dependencies.pinataAuthHeaders(),
      },
    )
    if (!response.ok) {
      throw new Error(
        `Pinata unpin failed: ${response.status} ${await response.text()}`,
      )
    }
  }

  async function fetchFileFromIPFS(
    cid: string,
    gateway: string,
  ): Promise<Buffer> {
    const response = await dependencies.fetch(`${gateway}${cid}`, {
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const fileData = await (
      response as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer()
    return Buffer.from(fileData)
  }

  function warmIPFSHash(hash: string) {
    for (const gateway of dependencies.warmGateways()) {
      fetchFileFromIPFS(hash, gateway)
        .then(() => dependencies.debugLog(`Gateway ${gateway} warmed`))
        .catch((error) => dependencies.debugLog(`Gateway ${gateway} NOT warmed: ${error}`))
    }
  }

  return { pinFileToIPFS, pinImageURLToIPFS, pinJSONToIPFS, unpin, fetchFileFromIPFS, warmIPFSHash }
}

const defaultClient = buildIPFSClient()

export const pinImageURLToIPFS = defaultClient.pinImageURLToIPFS
export const pinJSONToIPFS = defaultClient.pinJSONToIPFS
export const unpin = defaultClient.unpin
export const warmIPFSHash = defaultClient.warmIPFSHash

export function linkToIPFSGateway(hash: string) {
  return buildIPFSGatewayLink(config.PINATA_GATEWAY, config.PINATA_GATEWAY_KEY, hash)
}
