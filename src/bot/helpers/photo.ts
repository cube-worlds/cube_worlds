import type { Context } from "#root/bot/context.js";

export async function getUserProfilePhoto(ctx: Context) {
  const photos = await ctx.getUserProfilePhotos();
  if (photos.total_count > 0) {
    const lastPhotoArray =
      photos.photos[Math.floor(Math.random() * photos.photos.length)];
    const photo = lastPhotoArray?.sort(
      (a, b) => (b.file_size ?? 0) - (a.file_size ?? 0),
    )[0];
    if (photo) return photo;
  }
}

export async function getUserProfileFile(ctx: Context) {
  const photo = await getUserProfilePhoto(ctx);
  if (photo) {
    return ctx.api.getFile(photo.file_id);
  }
}
