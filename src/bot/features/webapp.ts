import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("webapp", logHandle("command-webapp"), (ctx) => {
  return ctx.reply("Test webapp", {
    reply_markup: new InlineKeyboard().webApp(
      "Open Web App",
      config.WEB_APP_URL,
    ),
  });
});

export { composer as webappFeature };
