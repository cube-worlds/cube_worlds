import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
// import { config } from "#root/config.js";
import { changeImageData } from "../callback-data/image-selection.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

enum SelectImageButton {
  Refresh = "image-refresh",
  Done = "image-done",
}

async function getUserProfilePhoto(ctx: Context) {
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

async function sendPhoto(ctx: Context) {
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

feature.command("start", logHandle("command-start"), async (ctx) => {
  // const author = await ctx.getAuthor();
  // const premium = author.user.is_premium ?? false;
  // const { username } = author.user; // can be undefined
  // const name = `${author.user.first_name} ${author.user.last_name}`;
  // const description = "Super puper mega cool warrior"
  sendPhoto(ctx);
});

feature.callbackQuery(
  changeImageData.filter(),
  logHandle("keyboard-image-select"),
  async (ctx) => {
    const { select } = changeImageData.unpack(ctx.callbackQuery.data);
    switch (select) {
      case SelectImageButton.Refresh: {
        const photo = await getUserProfilePhoto(ctx);
        if (!photo) {
          break;
        }
        ctx.deleteMessage();
        sendPhoto(ctx);
        break;
      }
      case SelectImageButton.Done: {
        await ctx.editMessageReplyMarkup({});
        // await ctx.react("🎉");
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as startFeature };
