import { config } from "#root/config.js";
import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { logger } from "#root/logger";
import { sleep } from "../helpers/ton";
import { timeUnitsBetween } from "../helpers/time";
import { sendMessageToAdmins, sendPlaceInLine } from "../helpers/telegram";
import { UserState, addPoints } from "../models/user";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("dice", logHandle("command-dice"), async (ctx) => {
  if (!ctx.dbuser.wallet || ctx.dbuser.state !== UserState.Submited) {
    await ctx.reply(ctx.t("unhandled"));
    return;
  }
  const waitMinutes = config.isProd ? 5 : 1;
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

  const lastDicedTime = ctx.dbuser.dicedAt.getTime();
  const suspicionTime = waitMinutes * 3;
  const compareDateForCaptcha = new Date(
    lastDicedTime + suspicionTime * 60 * 1000,
  );
  if (compareDateForCaptcha > now) {
    if (!ctx.dbuser.suspicionDices) {
      ctx.dbuser.suspicionDices = 0;
    }
    ctx.dbuser.suspicionDices += 1;
    logger.info(
      `${ctx.dbuser.id} has ${ctx.dbuser.suspicionDices} suspicion dices`,
    );
  } else {
    ctx.dbuser.suspicionDices = 0;
  }

  const dice1 = ctx.replyWithDice("🎲");
  const dice2 = ctx.replyWithDice("🎲");
  const result = await Promise.all([dice1, dice2]);
  const value1 = result[0].dice.value;
  const value2 = result[1].dice.value;
  const isRecurred = value1 === value2;
  if (isRecurred) {
    if (!ctx.dbuser.diceSeries) {
      ctx.dbuser.diceSeries = 1;
    }
    if (ctx.dbuser.diceSeriesNumber === value1) {
      ctx.dbuser.diceSeries = (ctx.dbuser.diceSeries ?? 0) + 1;
    } else {
      ctx.dbuser.diceSeries = 1;
      ctx.dbuser.diceSeriesNumber = value1;
    }
  } else {
    ctx.dbuser.diceSeries = undefined;
    ctx.dbuser.diceSeriesNumber = undefined;
  }

  const diceSeries = ctx.dbuser.diceSeries ?? 0;
  const diceSeriesNumber = ctx.dbuser.diceSeriesNumber ?? 0;
  const username = ctx.dbuser.name ?? "undefined";

  let score = value1 + value2;
  if (diceSeries > 1) {
    score *= diceSeries;
  }

  ctx.dbuser.dicedAt = now;
  await ctx.dbuser.save();
  await addPoints(ctx.dbuser.id, BigInt(score));

  sleep(3000)
    .then(async (_) => {
      if (!ctx.dbuser.minted && diceSeries === 3) {
        ctx.dbuser.diceWinner = true;
        await ctx.dbuser.save();
        await ctx.reply(
          ctx.t("dice.mint_winner", {
            username,
            diceSeriesNumber,
            diceSeries,
          }),
        );
        await sendMessageToAdmins(
          ctx.api,
          `🎲 Pair of ${diceSeriesNumber} dices ${diceSeries} times in a row by @${username}!`,
        );
        await ctx.replyWithSticker(
          "CAACAgIAAxkBAAEq6zpmIPgeW-peX09nTeFVvHXneFJZaQACQxoAAtzjkEhebdhBXbkEnzQE",
        );
      } else {
        await (diceSeries > 1
          ? ctx.reply(
              ctx.t("dice.success_series", {
                score,
                diceSeries,
                diceSeriesNumber,
              }),
            )
          : ctx.reply(ctx.t("dice.success", { score })));
        await sleep(1000);
        await sendPlaceInLine(ctx.api, ctx.dbuser.id, true);
      }
    })
    .catch((error) => logger.error(error));
});

export { composer as diceFeature };
