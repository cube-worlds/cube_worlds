import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { findUserById } from "#root/bot/models/user.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

async function checkReferal(ctx: Context) {
  const payload = ctx.match;
  if (payload) {
    if (ctx.dbuser.wallet) {
      return;
    }
    const receiverId = Number(payload);
    const receiver = await findUserById(receiverId);
    if (!receiver) {
      return ctx.reply(ctx.t("vote.no_receiver"));
    }
    if (receiverId === ctx.dbuser.id) {
      return ctx.reply(ctx.t("vote.self_vote"));
    }
    ctx.dbuser.referalId = receiverId;
    await ctx.dbuser.save();
  }
}

feature.command("start", logHandle("command-start"), async (ctx) => {
  await ctx.reply(ctx.t("start"), {
    link_preview_options: { is_disabled: true },
  });
  await checkReferal(ctx);
});

export { composer as startFeature };
