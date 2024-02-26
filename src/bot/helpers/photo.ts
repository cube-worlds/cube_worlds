import type { Context } from "#root/bot/context.js";
import { photoKeyboard } from "#root/bot/keyboards/photo.js";

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

export async function sendPhoto(ctx: Context) {
  const photo = await getUserProfilePhoto(ctx);
  if (!photo) {
    return ctx.reply(
      "Make sure that you upload image to your telegram profile",
    ); // or wait image just in chat
  }
  // const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${photo.file_path}`;
  // TODO: transform to WARRIOR IMAGE!!!
  await ctx.replyWithPhoto(photo.file_id, {
    reply_markup: {
      inline_keyboard: photoKeyboard,
    },
  });
}
