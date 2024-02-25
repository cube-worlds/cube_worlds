import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { UserState } from "#root/bot/models/user.js";
import { voteScore } from "../helpers/votes.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("reset", logHandle("command-reset"), async (ctx) => {
  ctx.dbuser.state = UserState.WaitImage;
  ctx.dbuser.votes = await voteScore(ctx);
  ctx.dbuser.save();
  return ctx.reply(ctx.t("reset"));
});

export { composer as resetFeature };
