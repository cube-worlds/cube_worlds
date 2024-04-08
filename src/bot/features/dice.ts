import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { sleep } from "../helpers/ton";
import { timeUnitsBetween } from "../helpers/time";
import { sendPlaceInLine } from "../helpers/telegram";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("dice", logHandle("command-dice"), async (ctx) => {
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
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const dice1 = ctx.replyWithDice("🎲");
    const dice2 = ctx.replyWithDice("🎲");
    const result = await Promise.all([dice1, dice2]);
    const score = result[0].dice.value + result[1].dice.value;
    ctx.dbuser.votes += BigInt(score);
    ctx.dbuser.dicedAt = now;
    await ctx.dbuser.save();
    await sleep(3000);
    await ctx.reply(ctx.t("dice.success", { score }));
    await sleep(1000);
    await sendPlaceInLine(ctx.api, ctx.dbuser, true);
  })();
});

export { composer as diceFeature };
