import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { saveImage, saveJSON } from '#root/common/helpers/files'
import { config } from '#root/config'
import { logger } from '#root/logger'
import pinataSDK from '@pinata/sdk'
import fetch from 'node-fetch'

// eslint-disable-next-line new-cap
const pinata = new pinataSDK({
    pinataApiKey: config.PINATA_API_KEY,
    pinataSecretApiKey: config.PINATA_API_SECRET,
})

export async function pinImageURLToIPFS(
    adminIndex: number,
    username: string,
    imageURL: string,
): Promise<string> {
    const image = await fetch(imageURL)
    const arrayBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const imageFileName = imageURL.slice((imageURL.lastIndexOf('/') ?? 0) + 1) ?? ''
    const fileExtension = imageFileName.split('.').pop()
    const newFileName = `${username}_${adminIndex}.${fileExtension}`
    saveImage(username, newFileName, buffer)

    const stream = Readable.from(buffer)
    const response = await pinata.pinFileToIPFS(stream, {
        pinataMetadata: { name: newFileName },
    })
    return response.IpfsHash
}

export async function pinJSONToIPFS(
    adminIndex: number,
    username: string,
    json: object,
): Promise<string> {
    const jsonPath = saveJSON(adminIndex, username, json)
    const response = await pinata.pinFromFS(jsonPath, {
        pinataMetadata: { name: `${username}_${adminIndex}.json` },
    })
    return response.IpfsHash
}

export async function unpin(hash: string) {
    return pinata.unpin(hash)
}

export function linkToIPFSGateway(hash: string) {
    return `${config.PINATA_GATEWAY}/ipfs/${hash}?pinataGatewayToken=${config.PINATA_GATEWAY_KEY}`
}

async function fetchFileFromIPFS(cid: string, gateway: string): Promise<Buffer> {
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
            .catch(error => logger.debug(`Gateway ${gateway} NOT warmed: ${error}`))
    }
}
