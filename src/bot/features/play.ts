import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("play", logHandle("command-play"), async (ctx) => {
  await (ctx.dbuser.minted
    ? ctx.reply(ctx.t("play.minted"), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ctx.t("play.clicker"),
                url: `https://t.me/${config.BOT_NAME}/clicker`,
              },
            ],
          ],
        },
      })
    : ctx.reply(ctx.t("play.not_minted")));
});

export { composer as playFeature };
