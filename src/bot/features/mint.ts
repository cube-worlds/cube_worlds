import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";
import { UserState } from "#root/bot/models/user.js";
import { getUserProfilePhoto } from "#root/bot/helpers/photo.js";
import { Address } from "ton-core";
import { voteScore } from "../helpers/votes.js";

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
    case UserState.WaitDescription: {
      const photo = await getUserProfilePhoto(ctx);
      if (!photo) {
        return ctx.reply(
          "Make sure that you upload image to your telegram profile",
        );
      }

      const author = await ctx.getAuthor();
      ctx.dbuser.name = `${author.user.first_name}${author.user.username ? ` "${author.user.username}" ` : " "}${author.user.last_name === undefined ? "" : author.user.last_name}`;
      ctx.dbuser.description = "Super puper mega cool warrior";
      ctx.dbuser.state = UserState.WaitWallet;
      ctx.dbuser.votes = await voteScore(ctx);
      ctx.dbuser.save();
      ctx.reply(ctx.t("wallet.wait"));
      // TODO: save user provided description
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

export { composer as mintFeature };
