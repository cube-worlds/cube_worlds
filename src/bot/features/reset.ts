import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { UserState } from "#root/bot/models/user.js";
import { voteScore } from "#root/bot/helpers/votes.js";
import { config } from "#root/config";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("reset", logHandle("command-reset"), async (ctx) => {
  if (ctx.dbuser.minted) {
    const nftUrl = ctx.dbuser.nftUrl ?? "";
    const collectionOwner = config.COLLECTION_OWNER;
    return ctx.reply(ctx.t("queue.success", { nftUrl, collectionOwner }));
  }
  ctx.dbuser.state = UserState.WaitNothing;
  ctx.dbuser.votes = await voteScore(ctx);
  ctx.dbuser.save();
  return ctx.reply(ctx.t("reset"));
});

export { composer as resetFeature };
