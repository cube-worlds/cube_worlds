import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
// import { config } from "#root/config.js";
import { changeImageData } from "../callback-data/image-selection.js";
import {
  SelectImageButton,
  getUserProfilePhoto,
  sendPhoto,
} from "../helpers/photo.js";
import { UserState } from "../models/user.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("mint", logHandle("command-mint"), async (ctx) => {
  // const author = await ctx.getAuthor();
  // const premium = author.user.is_premium ?? false;
  // const { username } = author.user; // can be undefined
  // const name = `${author.user.first_name} ${author.user.last_name}`;
  // const description = "Super puper mega cool warrior"
  switch (ctx.session.state) {
    case UserState.WaitDescription: {
      break;
    }
    case UserState.WaitName: {
      break;
    }
    // default = UserState.WaitImage:
    default: {
      sendPhoto(ctx);
    }
  }
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
          return;
        }
        ctx.deleteMessage();
        sendPhoto(ctx);
        break;
      }
      case SelectImageButton.Done: {
        await ctx.editMessageReplyMarkup({});
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as mintFeature };
