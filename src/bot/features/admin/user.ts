import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { findUserByName } from "../../models/user";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("user", logHandle("command-user"), async (ctx) => {
  const username = ctx.match.trim();
  if (username) {
    const user = await findUserByName(username.replace(/^@/, ""));
    if (!user) return ctx.reply(`User ${username} not found`);
    return ctx.reply(user.toString());
  }
  return ctx.reply("/user [username]");
});

export { composer as userFeature };
