import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { placeInLine } from "#root/bot/models/user.js";
import { config } from "#root/config";
import { sleep } from "../helpers/ton";
import { toEmoji } from "../helpers/emoji";
import { timeUnitsBetween } from "../helpers/time";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("dice", logHandle("command-dice"), async (ctx) => {
  if (ctx.dbuser.minted) {
    const nftUrl = ctx.dbuser.nftUrl ?? "";
    const collectionOwner = config.COLLECTION_OWNER;
    return ctx.reply(ctx.t("queue.success", { nftUrl, collectionOwner }), {
      link_preview_options: { is_disabled: true },
    });
  }
  const waitMinutes = 5;
  const waitDate = new Date(
    ctx.dbuser.dicedAt.getTime() + waitMinutes * 60 * 1000,
  );
  const now = new Date();
  const waitDateToCompare = new Date(waitDate.getTime() - 3000);
  if (waitDateToCompare > now) {
    const between = timeUnitsBetween(now, waitDate);
    const { minutes, seconds } = between;
    return ctx.reply(
      ctx.t("dice.wait", {
        minutes,
        seconds,
      }),
    );
  }
  const dice1 = ctx.replyWithDice("🎲");
  const dice2 = ctx.replyWithDice("🎲");
  const result = await Promise.all([dice1, dice2]);
  const score = result[0].dice.value + result[1].dice.value;
  ctx.dbuser.votes += score;
  ctx.dbuser.dicedAt = now;
  await ctx.dbuser.save();
  const placeNumber = await placeInLine(ctx.dbuser.votes);
  const place = toEmoji(placeNumber);
  await sleep(3000);
  return ctx.reply(ctx.t("dice.success", { place, score }));
});

export { composer as diceFeature };
