import type { CNFT } from '#root/common/models/CNFT'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import {
  cnftHexColor,
  CNFTImageType,
  getCNFTByIndex,
  getCNFTByWallet,
} from '#root/common/models/CNFT'
import { logger } from '#root/logger'
import sharp from 'sharp'

function nftImage(type: CNFTImageType) {
  if (type === CNFTImageType.Dice) {
    return 'dice'
  }
  if (type === CNFTImageType.Whale) {
    return 'whale'
  }
  if (type === CNFTImageType.Diamond) {
    return 'diamond'
  }
  if (type === CNFTImageType.Coin) {
    return 'coin'
  }
  if (type === CNFTImageType.Knight) {
    return 'knight'
  }
  return 'common'
}

function toJSON(nft: DocumentType<CNFT>) {
  return {
    name: `Cube Worlds Citizen #${nft.index}`,
    description: 'Thank you for your participation in the Cube Worlds Project!',
    image: `https://cubeworlds.club/api/nft/${nft.type.toLowerCase()}-${nft.color}.webp`,
    attributes: [
      { trait_type: 'Type', value: nft.type },
      { trait_type: 'Color', value: nft.color },
    ],
    buttons: [
      {
        label: 'Explore Cube Worlds',
        uri: 'https://t.me/cube_worlds_bot',
      },
    ],
  }
}

async function nftHandler(fastify: FastifyInstance) {
  fastify.get('/collection.json', (_request: any, _reply: any) => {
    return {
      name: 'Cube Worlds Citizens',
      description: 'Cube Worlds Project Citizens',
      image: 'https://cubeworlds.club/avatar.png',
      // external_url: null,
      // external_link: null,
      social_links: [
        'https://t.me/cube_worlds_bot',
        'https://twitter.com/cube_worlds',
      ],
      marketplace: 'getgems.io',
      cover_image: 'https://cubeworlds.club/background.png',
    }
  })

  fastify.get('/:address', async (request: any, reply: any) => {
    const { address } = request.params
    if (!address) {
      return reply.status(400).send({ error: 'No address provided' })
    }
    try {
      const nft = await getCNFTByWallet(address)
      if (!nft) {
        return reply.status(404).send({ error: 'NFT not found' })
      }
      return toJSON(nft)
    } catch {
      return reply.status(400).send({ error: 'Invalid address format' })
    }
  })

  fastify.get('/:index.json', async (request: any, reply: any) => {
    const { index } = request.params
    const parsedIndex = Number(index)
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      return reply.status(400).send({ error: 'Invalid index' })
    }
    const nft = await getCNFTByIndex(parsedIndex)
    if (!nft) {
      return reply.status(404).send({ error: 'NFT not found' })
    }
    return toJSON(nft)
  })

  const validImageTypes = new Set(
    Object.keys(CNFTImageType).map((k) => k.toLowerCase()),
  )

  fastify.get('/:image-:color.webp', async (request: any, reply: any) => {
    const { image, color } = request.params
    if (!image || !color) {
      return reply.status(400).send({ error: 'Invalid image/color parameters' })
    }
    if (!validImageTypes.has(image.toLowerCase())) {
      return reply.status(400).send({ error: 'Invalid image type' })
    }
    const parsedColor = Number(color)
    if (!Number.isInteger(parsedColor) || parsedColor < 0 || parsedColor > 10) {
      return reply.status(400).send({ error: 'Invalid color value' })
    }
    const capitalizedImage = image.charAt(0).toUpperCase() + image.slice(1)
    const typedImage = capitalizedImage as keyof typeof CNFTImageType
    const type = CNFTImageType[typedImage]
    const imageName = nftImage(type)
    logger.info(capitalizedImage, typedImage, type, imageName)
    const data = await sharp(`./src/backend/nft/${imageName}.png`)
      .flatten({ background: cnftHexColor(parsedColor) })
      .webp({ nearLossless: true, quality: 100 })
      .toBuffer()
    reply.header('Content-Type', 'image/webp')
    reply.header('Content-Length', data.length)
    reply.type('image/webp')
    reply.send(data)
  })
}

export default nftHandler
