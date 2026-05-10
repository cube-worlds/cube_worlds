import type { Context } from '#root/bot/context'
import { generateCaptchaToken } from '#root/backend/captcha'
import {
  evaluateCaptchaTrigger,
  processDiceRoll,
  shouldIncrementSuspicion,
  shouldTriggerMint,
} from '#root/bot/features/dice-logic'
import { logHandle } from '#root/common/helpers/logging'
import { generateRandomString } from '#root/common/helpers/random'
import {
  sendMessageToAdmins,
  sendPlaceInLine,
} from '#root/common/helpers/telegram'
import { sleep, timeUnitsBetween } from '#root/common/helpers/time'
import { BalanceChangeType } from '#root/common/models/Balance'
import { addPoints, UserState } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { Composer, InlineKeyboard } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('dice', logHandle('command-dice'), async (ctx) => {
  if (!ctx.dbuser.wallet || ctx.dbuser.state !== UserState.Submited) {
    await ctx.reply(ctx.t('unhandled'))
    return
  }
  const waitMinutes = config.isProd ? 5 : 1
  const waitDate = new Date(
    ctx.dbuser.dicedAt.getTime() + waitMinutes * 60 * 1000,
  )
  const now = new Date()
  const waitDateToCompare = new Date(waitDate.getTime() - 3000)
  if (waitDateToCompare > now) {
    const between = timeUnitsBetween(now, waitDate)
    const { minutes, seconds } = between
    return ctx.reply(
      ctx.t('dice.wait', {
        minutes,
        seconds,
      }),
    )
  }

  if (!ctx.dbuser.suspicionDices) {
    ctx.dbuser.suspicionDices = 0
  }
  if (shouldIncrementSuspicion(ctx.dbuser.dicedAt, now, waitMinutes)) {
    ctx.dbuser.suspicionDices += 1
    logger.info(
      `${ctx.dbuser.id} has ${ctx.dbuser.suspicionDices} suspicion dices`,
    )
  }
  //  else {
  //   ctx.dbuser.suspicionDices = 0;
  // }
  const captcha = evaluateCaptchaTrigger(ctx.dbuser.suspicionDices)
  if (captcha.trigger) {
    const issued = generateCaptchaToken(ctx.dbuser.id, captcha.expectedKills)
    ctx.dbuser.captchaNonce = issued.nonce
    ctx.dbuser.captchaIssuedAt = issued.issuedAt
    await ctx.dbuser.save()
    return ctx.reply(ctx.t('dice.captcha_title'), {
      reply_markup: new InlineKeyboard().webApp(
        ctx.t('dice.captcha_button'),
        `${config.WEB_APP_URL}/captcha/?user_id=${ctx.dbuser.id}&enemies=${captcha.enemies}&token=${encodeURIComponent(issued.token)}`,
      ),
    })
  }

  ctx.dbuser.diceKey = generateRandomString(10)
  await ctx.dbuser.save()
  await ctx.reply(ctx.t('dice.wish_luck'), {
    reply_markup: new InlineKeyboard().add({
      text: '🎲🎲',
      callback_data: `dice_${ctx.dbuser.diceKey}`,
    }),
  })
})

feature.callbackQuery(
  /^dice_/,
  logHandle('dice-callback-query'),
  async (ctx: Context) => {
    const userDiceData = `dice_${ctx.dbuser.diceKey}`
    const data = ctx.callbackQuery?.data ?? ''
    try {
      await ctx.deleteMessage()
    } catch {
      // do nothing
    }
    if (!(userDiceData === data)) {
      return
    }
    ctx.dbuser.diceKey = generateRandomString(10)
    await ctx.dbuser.save()
    const dice1 = ctx.replyWithDice('🎲')
    const dice2 = ctx.replyWithDice('🎲')
    const result = await Promise.all([dice1, dice2])
    const value1 = result[0].dice.value
    const value2 = result[1].dice.value
    const rolled = processDiceRoll(
      {
        diceSeries: ctx.dbuser.diceSeries,
        diceSeriesNumber: ctx.dbuser.diceSeriesNumber,
      },
      value1,
      value2,
    )
    ctx.dbuser.diceSeries = rolled.diceSeries
    ctx.dbuser.diceSeriesNumber = rolled.diceSeriesNumber

    const diceSeries = rolled.diceSeries ?? 0
    const diceSeriesNumber = rolled.diceSeriesNumber ?? 0
    const username = ctx.dbuser.name ?? 'undefined'
    const score = rolled.score

    ctx.dbuser.dicedAt = new Date()
    await ctx.dbuser.save()
    await addPoints(ctx.dbuser.id, BigInt(score), BalanceChangeType.Dice)

    sleep(3000)
      .then(async () => {
        if (shouldTriggerMint({ minted: ctx.dbuser.minted, diceSeries })) {
          ctx.dbuser.diceWinner = true
          await ctx.dbuser.save()
          await ctx.reply(
            ctx.t('dice.mint_winner', {
              username,
              diceSeriesNumber,
              diceSeries,
            }),
          )
          await sendMessageToAdmins(
            ctx.api,
            `🎲 Pair of ${diceSeriesNumber} dices ${diceSeries} times in a row by @${username}!`,
          )
          await ctx.replyWithSticker(
            'CAACAgIAAxkBAAEq6zpmIPgeW-peX09nTeFVvHXneFJZaQACQxoAAtzjkEhebdhBXbkEnzQE',
          )
        } else {
          await (diceSeries > 1
            ? ctx.reply(
                ctx.t('dice.success_series', {
                  score,
                  diceSeries,
                  diceSeriesNumber,
                }),
              )
            : ctx.reply(ctx.t('dice.success', { score })))
          await sleep(1000)
          await sendPlaceInLine(ctx.api, ctx.dbuser.id, true)
        }
      })
      .catch((error) => logger.error(error))
  },
)

export { composer as diceFeature }
