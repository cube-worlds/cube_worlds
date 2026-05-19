/* eslint-disable test/no-import-node-test */
import type { PhotoSize } from '@grammyjs/types'
import type { Context } from '#root/bot/context'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getUserProfileFile,
  getUserProfilePhoto,
} from '#root/common/helpers/photo'

interface PhotosResponse {
  total_count: number
  photos: PhotoSize[][]
}

function makeCtx(options: {
  photos: PhotosResponse
  getFile?: (fileId: string) => Promise<unknown>
}) {
  return {
    api: {
      getUserProfilePhotos: async () => options.photos,
      getFile: options.getFile ?? (async () => ({})),
    },
    logger: { debug: () => {} },
  } as unknown as Context
}

test('getUserProfilePhoto returns the largest square photo by file_size', async () => {
  const square720: PhotoSize = {
    file_id: 'sq-720',
    file_unique_id: 'u1',
    width: 720,
    height: 720,
    file_size: 100_000,
  }
  const square160: PhotoSize = {
    file_id: 'sq-160',
    file_unique_id: 'u2',
    width: 160,
    height: 160,
    file_size: 5000,
  }
  const wide: PhotoSize = {
    file_id: 'wide',
    file_unique_id: 'u3',
    width: 640,
    height: 480,
    file_size: 50_000,
  }
  const ctx = makeCtx({
    photos: { total_count: 1, photos: [[wide, square160, square720]] },
  })

  const photo = await getUserProfilePhoto(ctx, 7)
  assert.equal(photo.file_id, 'sq-720')
})

test('getUserProfilePhoto falls back to width when file_size is missing', async () => {
  const big = { file_id: 'big', file_unique_id: 'u1', width: 640, height: 640 } as PhotoSize
  const small = { file_id: 'small', file_unique_id: 'u2', width: 320, height: 320 } as PhotoSize
  const ctx = makeCtx({ photos: { total_count: 1, photos: [[small, big]] } })

  const photo = await getUserProfilePhoto(ctx, 7)
  assert.equal(photo.file_id, 'big')
})

test('getUserProfilePhoto wraps avatarNumber around the available albums', async () => {
  const a: PhotoSize = { file_id: 'a', file_unique_id: 'ua', width: 100, height: 100, file_size: 1 }
  const b: PhotoSize = { file_id: 'b', file_unique_id: 'ub', width: 100, height: 100, file_size: 1 }
  const ctx = makeCtx({ photos: { total_count: 2, photos: [[a], [b]] } })

  // avatarNumber 3 wraps to index 1 (3 % 2 === 1)
  const photo = await getUserProfilePhoto(ctx, 7, 3)
  assert.equal(photo.file_id, 'b')
})

test('getUserProfilePhoto throws "No profile avatars" when total_count is zero', async () => {
  const ctx = makeCtx({ photos: { total_count: 0, photos: [] } })
  await assert.rejects(() => getUserProfilePhoto(ctx, 7), /No profile avatars/)
})

test('getUserProfilePhoto throws "No square photos" when all photos are non-square', async () => {
  const wide: PhotoSize = { file_id: 'w', file_unique_id: 'uw', width: 640, height: 480, file_size: 9 }
  const ctx = makeCtx({ photos: { total_count: 1, photos: [[wide]] } })
  await assert.rejects(() => getUserProfilePhoto(ctx, 7), /No square photos/)
})

test('getUserProfileFile resolves the file for the selected square photo', async () => {
  const sq: PhotoSize = { file_id: 'sq', file_unique_id: 'u', width: 100, height: 100, file_size: 1 }
  const getFileCalls: string[] = []
  const ctx = makeCtx({
    photos: { total_count: 1, photos: [[sq]] },
    getFile: async (fileId) => {
      getFileCalls.push(fileId)
      return { file_id: fileId, file_path: `path/${fileId}` }
    },
  })

  const file = await getUserProfileFile(ctx, 7, 0)
  assert.deepEqual(getFileCalls, ['sq'])
  assert.deepEqual(file, { file_id: 'sq', file_path: 'path/sq' })
})
