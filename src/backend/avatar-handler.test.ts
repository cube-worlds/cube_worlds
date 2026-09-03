/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type {
  AvatarHandlerDependencies,
  AvatarUser,
  UploadedImage,
} from '#root/backend/avatar-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildAvatarHandler } from '#root/backend/avatar-handler'

interface AvatarTestContext {
  app: ReturnType<typeof fastify>
  savedProfile: Array<{ userId: number, index: number }>
  savedUploads: UploadedImage[]
  setAvatarCalls: Array<{ userId: number, path: string }>
}

function baseUser(overrides: Partial<AvatarUser> = {}): AvatarUser {
  return { id: 1001, name: 'alice', minted: false, ...overrides }
}

async function createContext(
  user: AvatarUser | null,
  overrides: Partial<AvatarHandlerDependencies> = {},
): Promise<AvatarTestContext> {
  const savedProfile: Array<{ userId: number, index: number }> = []
  const savedUploads: UploadedImage[] = []
  const setAvatarCalls: Array<{ userId: number, path: string }> = []

  const dependencies: AvatarHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    findAvatarUser: async () => user,
    listProfilePhotos: async () => [
      { index: 0, dataUrl: 'data:image/jpeg;base64,AAA' },
      { index: 1, dataUrl: 'data:image/jpeg;base64,BBB' },
    ],
    saveProfilePhoto: async (u, index) => {
      savedProfile.push({ userId: u.id, index })
      return '/data/alice/source.png'
    },
    saveUpload: async (_u, upload) => {
      savedUploads.push(upload)
      return '/data/alice/source.png'
    },
    extractUpload: async () => null,
    setAvatar: async (userId, path) => {
      setAvatarCalls.push({ userId, path })
    },
    readImageDataUrl: async (path) => `data:image/png;base64,${path}`,
    logError: () => {},
    ...overrides,
  }

  const app = fastify()
  await app.register(buildAvatarHandler(dependencies), { prefix: '/api/mint' })
  return { app, savedProfile, savedUploads, setAvatarCalls }
}

// AVATARS — list profile photos

test('POST /avatars returns the profile photo previews', async (t) => {
  const ctx = await createContext(baseUser())
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatars',
    payload: { initData: 'signed' },
  })

  const body = res.json()
  assert.equal(body.photos.length, 2)
  assert.equal(body.photos[0].index, 0)
  assert.equal(body.photos[1].dataUrl, 'data:image/jpeg;base64,BBB')
})

test('POST /avatars returns User not found for an unknown user', async (t) => {
  const ctx = await createContext(null)
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatars',
    payload: { initData: 'signed' },
  })
  assert.equal(res.json().error, 'User not found')
})

// SELECT — persist a profile photo as the source image

test('POST /avatar/select saves the chosen photo and sets it as avatar', async (t) => {
  const ctx = await createContext(baseUser())
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatar/select',
    payload: { initData: 'signed', index: 1 },
  })

  const body = res.json()
  assert.deepEqual(ctx.savedProfile, [{ userId: 1001, index: 1 }])
  assert.deepEqual(ctx.setAvatarCalls, [
    { userId: 1001, path: '/data/alice/source.png' },
  ])
  assert.equal(body.avatar, 'data:image/png;base64,/data/alice/source.png')
})

test('POST /avatar/select refuses for a minted user', async (t) => {
  const ctx = await createContext(baseUser({ minted: true }))
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatar/select',
    payload: { initData: 'signed', index: 0 },
  })
  assert.equal(res.json().error, 'Already minted')
  assert.equal(ctx.savedProfile.length, 0)
})

// UPLOAD — custom source image

test('POST /avatar/upload normalizes and saves a JPEG upload', async (t) => {
  const upload: UploadedImage = {
    initData: 'signed',
    buffer: new Uint8Array([1, 2, 3]),
    mime: 'image/jpeg',
  }
  const ctx = await createContext(baseUser(), {
    extractUpload: async () => upload,
  })
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatar/upload',
    payload: { anything: true },
  })

  const body = res.json()
  assert.equal(ctx.savedUploads.length, 1)
  assert.deepEqual(ctx.setAvatarCalls, [
    { userId: 1001, path: '/data/alice/source.png' },
  ])
  assert.equal(body.avatar, 'data:image/png;base64,/data/alice/source.png')
})

test('POST /avatar/upload rejects unsupported mime types', async (t) => {
  const ctx = await createContext(baseUser(), {
    extractUpload: async () => ({
      initData: 'signed',
      buffer: new Uint8Array([1]),
      mime: 'image/gif',
    }),
  })
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatar/upload',
    payload: {},
  })
  assert.match(res.json().error, /JPEG and PNG/i)
  assert.equal(ctx.savedUploads.length, 0)
})

test('POST /avatar/upload rejects a request without a file', async (t) => {
  const ctx = await createContext(baseUser())
  t.after(() => ctx.app.close())

  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/mint/avatar/upload',
    payload: {},
  })
  assert.equal(res.json().error, 'No file uploaded')
})
