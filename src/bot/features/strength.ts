import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("strength", logHandle("command-strength"), async (ctx) => {
  const oldStrength = ctx.dbuser.strength ?? 0.35;
  const newStrength = Number.parseFloat(ctx.match.trim());
  if (newStrength && !Number.isNaN(newStrength)) {
    if (newStrength < 0 || newStrength > 1) {
      return ctx.reply("New strength value MUST be between 0 and 1");
    }
    ctx.dbuser.strength = newStrength;
    await ctx.dbuser.save();
    return ctx.reply(`New strength: <code>/strength ${newStrength}</code>`);
  }
  return ctx.reply(`Current strength: <code>/strength ${oldStrength}</code>`);
});

export { composer as strengthFeature };
