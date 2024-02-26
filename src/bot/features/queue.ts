import { Composer, InputMediaBuilder } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { queueMenu } from "#root/bot/keyboards/queue-menu.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { config } from "#root/config.js";
import { changeImageData } from "../callback-data/image-selection.js";
import { getUserProfileFile } from "../helpers/photo.js";
import { SelectImageButton, photoKeyboard } from "../keyboards/photo.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  return ctx.reply(ctx.t("queue"), { reply_markup: queueMenu });
});

feature.callbackQuery(
  changeImageData.filter(),
  logHandle("keyboard-image-select"),
  async (ctx) => {
    const { select } = changeImageData.unpack(ctx.callbackQuery.data);
    switch (select) {
      case SelectImageButton.Refresh: {
        // TODO: change to AI generated image
        const photo = await getUserProfileFile(ctx);
        if (!photo) {
          return ctx.reply(ctx.t("wrong"));
        }

        const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${photo.file_path}`;
        ctx.dbuser.image = photoUrl;
        ctx.dbuser.save();

        const newMedia = InputMediaBuilder.photo(photo.file_id);
        ctx.editMessageMedia(newMedia, {
          reply_markup: { inline_keyboard: photoKeyboard },
        });
        break;
      }
      case SelectImageButton.Done: {
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as queueFeature };
