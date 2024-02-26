import { photoKeyboard, SelectImageButton } from "#root/bot/keyboards/photo.js";
import { Composer, InputMediaBuilder } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";
import { changeImageData } from "#root/bot/callback-data/image-selection.js";
import { UserState } from "#root/bot/models/user.js";
import { getUserProfilePhoto, sendPhoto } from "#root/bot/helpers/photo.js";
import { voteScore } from "#root/bot/helpers/votes.js";
import { Address } from "ton-core";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.on("message:text", logHandle("message-handler")).filter(
  (ctx) => ctx.dbuser.state === UserState.WaitWallet,
  async (ctx) => {
    try {
      const address = Address.parse(ctx.message.text);
      ctx.dbuser.wallet = address.toString();
      ctx.dbuser.state = UserState.Submited;
      ctx.dbuser.save();
      ctx.reply(
        ctx.t("speedup", {
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
          collectionAddress: config.COLLECTION_ADDRESS,
        }),
      );
    } catch (error) {
      ctx.reply(ctx.t("wallet.incorrect"));
      ctx.logger.warn((error as Error).message);
    }
  },
);

feature.command("mint", logHandle("command-mint"), async (ctx) => {
  switch (ctx.dbuser.state) {
    case UserState.WaitImage: {
      sendPhoto(ctx);
      break;
    }
    case UserState.WaitDescription: {
      break;
    }
    case UserState.WaitName: {
      break;
    }
    case UserState.WaitWallet: {
      ctx.reply(ctx.t("wallet.wait"));
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
    default: {
      break;
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
        const newMedia = InputMediaBuilder.photo(photo.file_id);
        ctx.editMessageMedia(newMedia, {
          reply_markup: { inline_keyboard: photoKeyboard },
        });
        break;
      }
      case SelectImageButton.Done: {
        if (ctx.dbuser) {
          const author = await ctx.getAuthor();
          ctx.dbuser.name = `${author.user.first_name}${author.user.username ? ` "${author.user.username}" ` : " "}${author.user.last_name === undefined ? "" : author.user.last_name}`;
          ctx.dbuser.description = "Super puper mega cool warrior";
          ctx.dbuser.state = UserState.WaitWallet;
          ctx.dbuser.save();
        }
        ctx.editMessageReplyMarkup({});
        ctx.reply(ctx.t("wallet.wait"));
        ctx.dbuser.votes = await voteScore(ctx);
        ctx.dbuser.save();
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as mintFeature };
