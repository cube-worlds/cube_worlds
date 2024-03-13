import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { placeInLine } from "#root/bot/models/user.js";

function timeUnitsBetween(startDate: Date, endDate: Date) {
  let delta = Math.abs(endDate.getTime() - startDate.getTime()) / 1000;
  const isNegative = startDate > endDate ? -1 : 1;
  const units: [
    [string, number],
    [string, number],
    [string, number],
    [string, number],
  ] = [
    ["days", 24 * 60 * 60],
    ["hours", 60 * 60],
    ["minutes", 60],
    ["seconds", 1],
  ];
  // eslint-disable-next-line unicorn/no-array-reduce
  return units.reduce(
    // eslint-disable-next-line no-return-assign, @typescript-eslint/no-explicit-any
    (accumulator: any, [key, value]) =>
      (
        // eslint-disable-next-line no-sequences
        (accumulator[key] = Math.floor(delta / value) * isNegative),
        (delta -= accumulator[key] * isNegative * value),
        accumulator
      ),
    {},
  );
}

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("dice", logHandle("command-dice"), async (ctx) => {
  const waitMinutes = 60;
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
  const diceResult = await ctx.replyWithDice("🎲");
  ctx.dbuser.votes += diceResult.dice.value;
  ctx.dbuser.dicedAt = now;
  await ctx.dbuser.save();
  const place = await placeInLine(ctx.dbuser.votes);
  return ctx.reply(
    ctx.t("dice.success", { place, score: diceResult.dice.value }),
  );
});

export { composer as diceFeature };
