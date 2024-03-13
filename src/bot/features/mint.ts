import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";
import {
  UserState,
  findUserByAddress,
  placeInLine,
} from "#root/bot/models/user.js";
import { getUserProfilePhoto } from "#root/bot/helpers/photo.js";
import { Address } from "@ton/core";
import { voteScore } from "#root/bot/helpers/votes.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

function isAddressValid(a: Address): boolean {
  try {
    return a.workChain === 0 || a.workChain === -1;
  } catch {
    return false;
  }
}

feature.on("message:text", logHandle("message-handler")).filter(
  (ctx) => ctx.dbuser.state === UserState.WaitDescription,
  async (ctx) => {
    ctx.dbuser.description = ctx.message.text;
    ctx.dbuser.state = UserState.WaitWallet;
    ctx.dbuser.save();
    await ctx.reply(
      ctx.t("description.success", { description: ctx.message.text }),
    );
    ctx.reply(ctx.t("wallet.wait"));
  },
);

feature.on("message:text", logHandle("message-handler")).filter(
  (ctx) => ctx.dbuser.state === UserState.WaitWallet,
  async (ctx) => {
    try {
      const address = Address.parse(ctx.message.text);
      const valid = isAddressValid(address);
      if (!valid) {
        return ctx.reply(ctx.t("wallet.incorrect"));
      }
      const alreadyExistedWallet = await findUserByAddress(address);
      if (alreadyExistedWallet) {
        return ctx.reply(
          ctx.t("wallet.already_exists", { wallet: address.toString() }),
        );
      }
      ctx.dbuser.wallet = address.toString();
      ctx.dbuser.state = UserState.Submited;
      ctx.dbuser.save();
      const place = await placeInLine(ctx.dbuser.votes);
      ctx.reply(
        ctx.t("speedup", {
          place,
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
          collectionOwner: config.COLLECTION_OWNER,
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
    case UserState.WaitNothing: {
      const subscriber = await ctx.api.getChatMember(
        "@cube_worlds",
        ctx.dbuser.id,
      );
      const validStatuses = ["creator", "administrator", "member"];
      if (!validStatuses.includes(subscriber.status)) {
        return ctx.reply(ctx.t("subscribe_required"));
      }
      const photo = await getUserProfilePhoto(ctx, ctx.dbuser.id);
      if (!photo) {
        return ctx.reply(ctx.t("no_photo"));
      }
      const author = await ctx.getAuthor();
      if (!author.user.username) {
        return ctx.reply(ctx.t("no_username"));
      }
      ctx.dbuser.name = author.user.username;
      ctx.dbuser.votes = await voteScore(ctx);
      ctx.dbuser.state = UserState.WaitDescription;
      ctx.dbuser.save();
      ctx.reply(ctx.t("description.wait"));
      break;
    }
    case UserState.WaitDescription: {
      ctx.reply(ctx.t("description.wait"));
      break;
    }
    case UserState.WaitWallet: {
      ctx.reply(ctx.t("wallet.wait"));
      break;
    }
    case UserState.Submited: {
      const place = await placeInLine(ctx.dbuser.votes);
      ctx.reply(
        ctx.t("speedup", {
          place,
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
          collectionOwner: config.COLLECTION_OWNER,
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
