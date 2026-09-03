import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
}

interface SelectBody extends Body {
  index: number
}

export interface AvatarPhoto {
  index: number
  dataUrl: string
}

export interface AvatarUser {
  id: number
  name?: string
  minted: boolean
}

export interface UploadedImage {
  initData: string
  buffer: Uint8Array
  mime: string
}

export interface AvatarHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findAvatarUser: (id: number) => Promise<AvatarUser | null>
  // Optional fastify-scope setup (the composer registers multipart here).
  decorate?: (fastify: FastifyInstance) => Promise<void>
  // List the user's Telegram profile photos as small preview data URLs.
  listProfilePhotos: (userId: number) => Promise<AvatarPhoto[]>
  // Download profile photo #index at full size, normalize and persist it.
  // Returns the stored local path.
  saveProfilePhoto: (user: AvatarUser, index: number) => Promise<string>
  // Normalize and persist an uploaded image. Returns the stored local path.
  saveUpload: (user: AvatarUser, upload: UploadedImage) => Promise<string>
  // Pull the multipart upload out of the request (shape is composer-defined).
  extractUpload: (request: FastifyRequest) => Promise<UploadedImage | null>
  setAvatar: (userId: number, path: string) => Promise<void>
  readImageDataUrl: (path: string) => Promise<string | null>
  logError: (message: string) => void
}

const ALLOWED_UPLOAD_MIMES = new Set(['image/jpeg', 'image/png'])

const initDataBodySchema = {
  body: {
    type: 'object',
    properties: {
      initData: { type: 'string', maxLength: 8192 },
    },
  },
} as const

const selectBodySchema = {
  body: {
    type: 'object',
    properties: {
      initData: { type: 'string', maxLength: 8192 },
      index: { type: 'integer', minimum: 0, maximum: 99 },
    },
  },
} as const

export function buildAvatarHandler(dependencies: AvatarHandlerDependencies) {
  function resolveUserId(
    request: { validationError?: unknown },
    initData: string | undefined,
  ): { userId: number } | { error: string } {
    if (request.validationError) return { error: 'Invalid request body' }
    if (!initData) return { error: 'No initData or hash provided' }
    dependencies.validateInitData(initData)
    const parsed = dependencies.parseInitData(initData)
    const tgUserId = parsed?.user?.id
    if (!tgUserId) return { error: 'Invalid telegram user id' }
    return { userId: tgUserId }
  }

  async function loadUser(
    request: { validationError?: unknown },
    initData: string | undefined,
  ): Promise<{ user: AvatarUser } | { error: string }> {
    const resolved = resolveUserId(request, initData)
    if ('error' in resolved) return resolved
    const user = await dependencies.findAvatarUser(resolved.userId)
    if (!user) return { error: 'User not found' }
    return { user }
  }

  return async function avatarHandler(fastify: FastifyInstance) {
    if (dependencies.decorate) await dependencies.decorate(fastify)

    // The user's Telegram profile photos, as small previews to pick from.
    fastify.post<{ Body: Body }>(
      '/avatars',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const loaded = await loadUser(request, request.body?.initData)
          if ('error' in loaded) return loaded
          const photos = await dependencies.listProfilePhotos(loaded.user.id)
          return { photos }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    // Pick profile photo #index as the generation source image.
    fastify.post<{ Body: SelectBody }>(
      '/avatar/select',
      { schema: selectBodySchema, attachValidation: true },
      async (request) => {
        try {
          const loaded = await loadUser(request, request.body?.initData)
          if ('error' in loaded) return loaded
          const { user } = loaded
          if (user.minted) return { error: 'Already minted' }
          const index = request.body.index ?? 0

          const path = await dependencies.saveProfilePhoto(user, index)
          await dependencies.setAvatar(user.id, path)
          const avatar = await dependencies.readImageDataUrl(path)
          return { avatar }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    // Upload a custom source image (multipart: `initData` field + `file`).
    fastify.post(
      '/avatar/upload',
      async (request) => {
        try {
          const upload = await dependencies.extractUpload(request)
          if (!upload) return { error: 'No file uploaded' }
          if (!ALLOWED_UPLOAD_MIMES.has(upload.mime)) {
            return { error: 'Only JPEG and PNG images are supported' }
          }

          const loaded = await loadUser(request, upload.initData)
          if ('error' in loaded) return loaded
          const { user } = loaded
          if (user.minted) return { error: 'Already minted' }

          const path = await dependencies.saveUpload(user, upload)
          await dependencies.setAvatar(user.id, path)
          const avatar = await dependencies.readImageDataUrl(path)
          return { avatar }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}
