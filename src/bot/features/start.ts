import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { vote } from "#root/bot/helpers/database.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  const payload = ctx.match;
  if (payload) {
    const author = await ctx.getAuthor();
    const premium = author.user.is_premium ?? false;
    const add = premium ? 50 : 5;
    const added = await vote(payload, add);
    const isUpdated = added.modifiedCount > 0;
    ctx.reply(`You are successfully vote for ${payload}`);
    ctx.logger.info({ isUpdated });
  }
});

export { composer as startFeature };
