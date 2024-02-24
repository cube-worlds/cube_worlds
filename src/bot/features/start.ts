import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), async (ctx) => {
  const payload = ctx.match;
  if (payload) {
    const author = await ctx.getAuthor();
    const premium = author.user.is_premium ?? false;
    const add = premium ? 50 : 5;
    ctx.logger.error(add);
    // const isUpdated = added.modifiedCount > 0;
    ctx.reply(
      `You are successfully vote for ${payload}. You votes: ${ctx.dbuser.votes}`,
    );
  }
});

export { composer as startFeature };
