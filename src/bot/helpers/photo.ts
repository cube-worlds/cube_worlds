import type { Context } from "#root/bot/context.js";
import { logger } from "#root/logger";
import { PhotoSize } from "@grammyjs/types";

export async function getUserProfilePhoto(
  ctx: Context,
  userId: number,
  avatarNumber: number = 0,
): Promise<PhotoSize> {
  const photos = await ctx.api.getUserProfilePhotos(userId);
  ctx.logger.debug(photos);
  if (photos.total_count > 0) {
    const lastPhotoArray = photos.photos[avatarNumber % photos.photos.length];
    const photo = lastPhotoArray?.sort(
      (a, b) => (b.file_size ?? b.width) - (a.file_size ?? a.width),
    )[0];
    logger.info(photo);
    return photo;
  }
  throw new Error("Zero count photos");
}

export async function getUserProfileFile(
  ctx: Context,
  userId: number,
  avatarNumber: number,
) {
  const photo = await getUserProfilePhoto(ctx, userId, avatarNumber);
  if (photo) {
    return ctx.api.getFile(photo.file_id);
  }
  throw new Error("No user photo");
}
