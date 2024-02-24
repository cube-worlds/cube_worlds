import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";
import { changeImageData } from "#root/bot/callback-data/image-selection.js";
import { UserState } from "#root/bot/models/user.js";
import {
  SelectImageButton,
  getUserProfilePhoto,
  sendPhoto,
} from "#root/bot/helpers/photo.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("mint", logHandle("command-mint"), async (ctx) => {
  // const author = await ctx.getAuthor();
  // const premium = author.user.is_premium ?? false;
  // const { username } = author.user; // can be undefined
  // const name = `${author.user.first_name} ${author.user.last_name}`;
  // const description = "Super puper mega cool warrior"

  switch (ctx.dbuser.state) {
    case UserState.WaitDescription: {
      break;
    }
    case UserState.WaitName: {
      break;
    }
    case UserState.Submited: {
      ctx.reply(
        ctx.t("speedup", {
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
          collectionAddress: config.COLLECTION_ADDRESS,
        }),
      );
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
        if (ctx.dbuser) {
          ctx.dbuser.state = UserState.Submited;
          ctx.dbuser.save();
        }
        ctx.editMessageReplyMarkup({});
        ctx.reply(
          ctx.t("speedup", {
            inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
            collectionAddress: config.COLLECTION_ADDRESS,
          }),
        );
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as mintFeature };
