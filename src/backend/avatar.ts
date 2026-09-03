import type { Api } from 'grammy'
import type {
  AvatarHandlerDependencies,
  AvatarPhoto,
  AvatarUser,
  UploadedImage,
} from './avatar-handler'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import { Jimp, JimpMime } from 'jimp'
import { saveImage } from '#root/common/helpers/files'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { buildAvatarHandler } from './avatar-handler'
import { defaultParseInitData, defaultValidateInitData } from './init-data'

// Generation source images are normalized to a 640×640 PNG: square, and a
// multiple-of-64 size that the Stability img2img endpoint accepts.
const SOURCE_SIZE = 640
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_PROFILE_PHOTOS = 5

interface BotLike {
  api: Api
  token: string
}

async function normalizeToSquarePng(input: Uint8Array): Promise<Buffer> {
  const image = await Jimp.read(Buffer.from(input))
  image.cover({ w: SOURCE_SIZE, h: SOURCE_SIZE })
  return image.getBuffer(JimpMime.png)
}

async function readImageDataUrl(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function usernameOf(user: AvatarUser): string {
  return user.name ?? String(user.id)
}

interface MultipartValueField {
  type: 'field'
  value: unknown
}

interface MultipartFileField {
  type: 'file'
  mimetype: string
  toBuffer: () => Promise<Buffer>
}

type MultipartField = MultipartValueField | MultipartFileField

function createDefaultDependencies(bot: BotLike): AvatarHandlerDependencies {
  async function downloadTelegramFile(fileId: string): Promise<Buffer> {
    const file = await bot.api.getFile(fileId)
    if (!file.file_path) throw new Error('Telegram file has no path')
    const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Telegram file download failed: ${response.status}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }

  async function profilePhotoSets(userId: number) {
    const photos = await bot.api.getUserProfilePhotos(userId, {
      limit: MAX_PROFILE_PHOTOS,
    })
    return photos.photos
  }

  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findAvatarUser: async (id) => {
      const user = await findUserById(id)
      if (!user) return null
      return { id: user.id, name: user.name, minted: user.minted }
    },
    decorate: async (fastify) => {
      await fastify.register(fastifyMultipart, {
        attachFieldsToBody: true,
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
      })
    },
    listProfilePhotos: async (userId) => {
      const sets = await profilePhotoSets(userId)
      const result: AvatarPhoto[] = []
      for (const [index, sizes] of sets.entries()) {
        const sorted = [...sizes].sort((a, b) => a.width - b.width)
        const preview
          = sorted.find((p) => p.width >= 320) ?? sorted[sorted.length - 1]
        if (!preview) continue
        const buf = await downloadTelegramFile(preview.file_id)
        result.push({
          index,
          dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
        })
      }
      return result
    },
    saveProfilePhoto: async (user, index) => {
      const sets = await profilePhotoSets(user.id)
      const sizes = sets[index]
      if (!sizes || sizes.length === 0) {
        throw new Error('Profile photo not found')
      }
      const bySize = [...sizes].sort((a, b) => a.width - b.width)
      const largest = bySize[bySize.length - 1]
      const raw = await downloadTelegramFile(largest.file_id)
      const normalized = await normalizeToSquarePng(raw)
      return saveImage(usernameOf(user), 'source.png', normalized)
    },
    saveUpload: async (user, upload) => {
      const normalized = await normalizeToSquarePng(upload.buffer)
      return saveImage(usernameOf(user), 'source.png', normalized)
    },
    extractUpload: async (request): Promise<UploadedImage | null> => {
      const body = request.body as Record<string, MultipartField> | undefined
      const file = body?.file
      if (!file || file.type !== 'file') return null
      const initDataField = body?.initData
      const initData
        = initDataField && initDataField.type === 'field'
          ? String(initDataField.value ?? '')
          : ''
      return {
        initData,
        buffer: await file.toBuffer(),
        mime: file.mimetype,
      }
    },
    setAvatar: async (userId, avatarPath) => {
      const user = await findUserById(userId)
      if (!user) throw new Error('User not found')
      user.avatar = avatarPath
      await user.save()
    },
    readImageDataUrl,
    logError: (message) => logger.error(message),
  }
}

export function createAvatarHandler(bot: BotLike) {
  return buildAvatarHandler(createDefaultDependencies(bot))
}
