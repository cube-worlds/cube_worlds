import type { Context } from '#root/bot/context.js'
import type { PhotoSize } from '@grammyjs/types'
import { logger } from '#root/logger'

export async function getUserProfilePhoto(
  ctx: Context,
  userId: number,
  avatarNumber: number = 0,
): Promise<PhotoSize> {
  const photos = await ctx.api.getUserProfilePhotos(userId)
  ctx.logger.debug(photos)
  if (photos.total_count > 0) {
    const lastPhotoArray = photos.photos[avatarNumber % photos.photos.length]
    const squarePhotos = lastPhotoArray?.filter((p: PhotoSize) => p.width === p.height)
    if (squarePhotos.length > 0) {
      const photo = squarePhotos.sort(
        (a, b) => (b.file_size ?? b.width) - (a.file_size ?? a.width),
      )[0]
      logger.info(photo)
      return photo
    }
    throw new Error('No square photos')
  }
  throw new Error('No profile avatars')
}

export async function getUserProfileFile(ctx: Context, userId: number, avatarNumber: number) {
  const photo = await getUserProfilePhoto(ctx, userId, avatarNumber)
  if (photo) {
    return ctx.api.getFile(photo.file_id)
  }
  throw new Error('No user photo')
}
