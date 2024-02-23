import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { UserState } from "../models/user.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("reset", logHandle("command-reset"), (ctx) => {
  ctx.session.state = UserState.WaitImage;
  return ctx.reply(ctx.t("reset"));
});

export { composer as resetFeature };
