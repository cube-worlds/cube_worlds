import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

async function getUserProfilePhoto(ctx: Context) {
  const photos = await ctx.getUserProfilePhotos();
  if (photos.total_count > 0) {
    const lastPhotoArray = photos.photos[0];
    const photo = lastPhotoArray?.sort(
      (a, b) => (b.file_size ?? 0) - (a.file_size ?? 0),
    )[0];
    if (photo) {
      // ctx.logger.debug(lastPhotoArray);
      return ctx.api.getFile(photo.file_id);
    }
  }
}

feature.command("start", logHandle("command-start"), async (ctx) => {
  // const author = await ctx.getAuthor();
  // const premium = author.user.is_premium ?? false;
  // const { username } = author.user; // can be undefined
  // const name = `${author.user.first_name} ${author.user.last_name}`;
  // const description = "Super puper mega cool warrior"
  const photo = await getUserProfilePhoto(ctx);
  if (photo) {
    const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${photo.file_path}`;
    // TODO: transform to WARRIOR IMAGE!!!
    ctx.reply(photoUrl);
  }
});

export { composer as startFeature };
