import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { UserState } from "#root/bot/models/user.js";
import { queueMenu } from "#root/bot/keyboards/queue-menu.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  if (ctx.dbuser.state !== UserState.Submited) {
    return ctx.reply("You should send /mint request before use this command!");
  }

  return ctx.reply(ctx.t("queue"), { reply_markup: queueMenu });
});

export { composer as queueFeature };
