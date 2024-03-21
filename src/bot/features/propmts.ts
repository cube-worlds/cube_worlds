import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("positive", logHandle("command-propmpts"), async (ctx) => {
  const oldPositivePrompt = ctx.dbuser.positivePrompt;
  const newPositivePrompt = ctx.match;
  if (newPositivePrompt.trim()) {
    ctx.dbuser.positivePrompt = newPositivePrompt;
    await ctx.dbuser.save();
    return ctx.reply(
      `POSITIVE PROMPT WAS UPDATED
  
  Old prompt: <code>${oldPositivePrompt}</code>
  New prompt: <code>${ctx.dbuser.positivePrompt}</code>`,
    );
  }
  return ctx.reply(`<code>${newPositivePrompt}</code>`);
});

feature.command("negative", logHandle("command-propmpts"), async (ctx) => {
  const oldNegativePrompt = ctx.dbuser.negativePrompt;
  const newNegativePrompt = ctx.match;
  if (newNegativePrompt.trim()) {
    ctx.dbuser.negativePrompt = newNegativePrompt;
    await ctx.dbuser.save();
    return ctx.reply(
      `NEGATIVE PROMPT WAS UPDATED
      
Old prompt: <code>${oldNegativePrompt ?? ""}</code>
New prompt: <code>${ctx.dbuser.negativePrompt}</code>`,
    );
  }
  return ctx.reply(`<code>${newNegativePrompt}</code>`);
});

export { composer as promptsFeature };
