import type { Context } from "#root/bot/context.js";
import { changeImageData } from "../callback-data/image-selection.js";

export enum SelectImageButton {
  Refresh = "image-refresh",
  Done = "image-done",
}

export async function getUserProfilePhoto(ctx: Context) {
  const photos = await ctx.getUserProfilePhotos();
  if (photos.total_count > 0) {
    const lastPhotoArray =
      photos.photos[Math.floor(Math.random() * photos.photos.length)];
    const photo = lastPhotoArray?.sort(
      (a, b) => (b.file_size ?? 0) - (a.file_size ?? 0),
    )[0];
    if (photo) {
      // ctx.logger.debug(lastPhotoArray);
      return ctx.api.getFile(photo.file_id);
    }
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
      inline_keyboard: [
        [
          {
            text: "🔄 Refresh",
            callback_data: changeImageData.pack({
              select: SelectImageButton.Refresh,
            }),
          },
          {
            text: "✅ Done",
            callback_data: changeImageData.pack({
              select: SelectImageButton.Done,
            }),
          },
        ],
      ],
    },
  });
}
