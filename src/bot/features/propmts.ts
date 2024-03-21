import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("positive", logHandle("command-propmpts"), async (ctx) => {
  const oldPositivePrompt = ctx.dbuser.positivePrompt;
  ctx.dbuser.positivePrompt = ctx.match;
  await ctx.dbuser.save();
  return ctx.reply(
    `POSITIVE PROMPT WAS UPDATED

Old prompt: <code>${oldPositivePrompt}</code>
New prompt: <code>${ctx.dbuser.positivePrompt}</code>`,
  );
});

feature.command("negative", logHandle("command-propmpts"), async (ctx) => {
  const oldNegativePrompt = ctx.dbuser.negativePrompt;
  ctx.dbuser.negativePrompt = ctx.match;
  await ctx.dbuser.save();
  return ctx.reply(
    `NEGATIVE PROMPT WAS UPDATED
      
Old prompt: <code>${oldNegativePrompt ?? ""}</code>
New prompt: <code>${ctx.dbuser.negativePrompt}</code>`,
  );
});

export { composer as promptsFeature };
