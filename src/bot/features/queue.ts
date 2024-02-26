import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { queueMenu } from "#root/bot/keyboards/queue-menu.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  return ctx.reply(ctx.t("queue"), { reply_markup: queueMenu });
});

export { composer as queueFeature };
