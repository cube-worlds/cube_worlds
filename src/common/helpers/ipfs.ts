import { Buffer } from 'node:buffer'
import { saveImage, saveJSON } from '#root/common/helpers/files'
import { config } from '#root/config'
import { logger } from '#root/logger'
import FormData from 'form-data'
import fetch from 'node-fetch'

const PINATA_API_BASE = 'https://api.pinata.cloud'

function pinataAuthHeaders(): Record<string, string> {
  return {
    pinata_api_key: config.PINATA_API_KEY,
    pinata_secret_api_key: config.PINATA_API_SECRET,
  }
}

interface PinResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

async function pinFileToIPFS(
  buffer: Buffer,
  filename: string,
): Promise<PinResponse> {
  const form = new FormData()
  form.append('file', buffer, { filename })
  form.append('pinataMetadata', JSON.stringify({ name: filename }))

  const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { ...form.getHeaders(), ...pinataAuthHeaders() },
    body: form,
  })
  if (!response.ok) {
    throw new Error(
      `Pinata pinFileToIPFS failed: ${response.status} ${await response.text()}`,
    )
  }
  return (await response.json()) as PinResponse
}

export async function pinImageURLToIPFS(
  adminIndex: number,
  username: string,
  imageURL: string,
): Promise<string> {
  const image = await fetch(imageURL)
  const arrayBuffer = await image.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf('/') ?? 0) + 1) ?? ''
  const fileExtension = imageFileName.split('.').pop()
  const newFileName = `${username}_${adminIndex}.${fileExtension}`
  saveImage(username, newFileName, buffer)

  const response = await pinFileToIPFS(buffer, newFileName)
  return response.IpfsHash
}

export async function pinJSONToIPFS(
  adminIndex: number,
  username: string,
  json: object,
): Promise<string> {
  saveJSON(adminIndex, username, json)
  const filename = `${username}_${adminIndex}.json`

  const response = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...pinataAuthHeaders(),
    },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: filename },
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Pinata pinJSONToIPFS failed: ${response.status} ${await response.text()}`,
    )
  }
  const body = (await response.json()) as PinResponse
  return body.IpfsHash
}

export async function unpin(hash: string): Promise<void> {
  const response = await fetch(`${PINATA_API_BASE}/pinning/unpin/${hash}`, {
    method: 'DELETE',
    headers: pinataAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error(
      `Pinata unpin failed: ${response.status} ${await response.text()}`,
    )
  }
}

export function linkToIPFSGateway(hash: string) {
  return `${config.PINATA_GATEWAY}/ipfs/${hash}?pinataGatewayToken=${config.PINATA_GATEWAY_KEY}`
}

async function fetchFileFromIPFS(
  cid: string,
  gateway: string,
): Promise<Buffer> {
  const response = await fetch(`${gateway}${cid}`, {
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`)
  }
  const fileData = await response.arrayBuffer()
  return Buffer.from(fileData)
}

export function warmIPFSHash(hash: string) {
  // https://ipfs.github.io/public-gateway-checker/
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.eth.aragon.network/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.eth.aragon.network/ipfs/',
  ]

  for (const gateway of gateways) {
    fetchFileFromIPFS(hash, gateway)
      .then(() => logger.debug(`Gateway ${gateway} warmed`))
      .catch((error) => logger.debug(`Gateway ${gateway} NOT warmed: ${error}`))
  }
}
