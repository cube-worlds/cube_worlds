import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { findUserById } from "#root/bot/models/user.js";
import { VoteModel, isUserAlreadyVoted } from "#root/bot/models/vote.js";
import { voteScore } from "../helpers/votes";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

async function checkReferal(ctx: Context) {
  const payload = ctx.match;
  if (payload) {
    const giverId = ctx.dbuser.id;
    const receiverId = Number(payload);
    const receiver = await findUserById(receiverId);
    if (!receiver) {
      return ctx.reply("No receiver exists");
    }
    if (receiverId === giverId) {
      return ctx.reply("You can't vote for yourself");
    }
    if (await isUserAlreadyVoted(giverId)) {
      return ctx.reply("You already voted");
    }
    const add = await voteScore(ctx);
    const voteModel = new VoteModel();
    voteModel.giver = giverId;
    voteModel.receiver = receiverId;
    voteModel.quantity = add;
    await voteModel.save();

    receiver.votes += BigInt(add);
    await receiver.save();

    await ctx.reply(ctx.t("vote.success", { name: receiver.name ?? "" }));
  }
}

feature.command("start", logHandle("command-start"), async (ctx) => {
  await checkReferal(ctx);
  ctx.reply(ctx.t("start"), {
    link_preview_options: { is_disabled: true },
  });
});

export { composer as startFeature };
