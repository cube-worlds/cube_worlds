import { VoteModel, isUserAlreadyVoted } from "#root/bot/models/vote.js"
import { Composer } from "grammy"
import type { Context } from "#root/bot/context.js"
import { logHandle } from "#root/bot/helpers/logging.js"
import {
  UserState,
  addPoints,
  findUserByAddress,
} from "#root/bot/models/user.js"
import { getUserProfilePhoto } from "#root/bot/helpers/photo.js"
import { Address } from "@ton/core"
import { voteScore } from "#root/bot/helpers/votes.js"
import { ChatFullInfo } from "grammy/types"
import { logger } from "#root/logger"
import {
  getCubeChannel,
  getCubeChat,
  sendPlaceInLine,
} from "../helpers/telegram"
import { sendMintedMessage } from "../middlewares/check-not-minted"
import { isUserAddressValid } from "../helpers/ton"

const composer = new Composer<Context>()

const feature = composer.chatType("private")

async function getBio(ctx: Context) {
  const chat = await ctx.getChat()
  const { bio } = chat as ChatFullInfo.PrivateChat
  return bio?.trim()
}

async function sendWaitDescription(ctx: Context) {
  await ctx.reply(ctx.t("description.wait"))
  const bio = await getBio(ctx)
  if (bio) {
    await ctx.reply(ctx.t("description.fill", { bio }), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Correct",
              callback_data: "correct_description",
            },
          ],
        ],
      },
    })
  }
}

async function isUserSubscribed(
  ctx: Context,
  channel: string,
): Promise<boolean> {
  try {
    const subscriber = await ctx.api.getChatMember(channel, ctx.dbuser.id)
    const validStatuses = ["creator", "administrator", "member"]
    return validStatuses.includes(subscriber.status)
  } catch (error) {
    logger.error(`Check subscription error: ${error}`)
    return true
  }
}

async function sendReferralBonus(ctx: Context) {
  const giverId = ctx.dbuser.id
  const receiverId = ctx.dbuser.referalId
  if (!receiverId || (await isUserAlreadyVoted(giverId))) {
    return
  }
  const add = await voteScore(ctx)
  const voteModel = new VoteModel()
  voteModel.giver = giverId
  voteModel.receiver = receiverId
  voteModel.quantity = add
  await voteModel.save()

  await addPoints(receiverId, BigInt(add))
  await sendPlaceInLine(ctx.api, receiverId, true)
}

async function mintAction(
  ctx: Context,
  removeSubscriptionCheckMessage: boolean = false,
) {
  if (ctx.dbuser.minted) {
    return sendMintedMessage(
      ctx.api,
      ctx.dbuser.id,
      ctx.dbuser.language,
      ctx.dbuser.nftUrl ?? "",
    )
  }

  const chat = getCubeChat(ctx.dbuser.language)
  const isChatSubscribed = await isUserSubscribed(ctx, chat)
  const channel = getCubeChannel(ctx.dbuser.language)
  const isChannelSubscribed = await isUserSubscribed(ctx, channel)
  logger.error(`Channel ${isChannelSubscribed}`)
  logger.error(`Chat ${isChatSubscribed}`)
  if (isChannelSubscribed && isChatSubscribed) {
    if (removeSubscriptionCheckMessage) {
      await ctx.deleteMessage()
    }
    await sendReferralBonus(ctx)
  } else {
    return ctx.reply(ctx.t("mint.subscribe_required", { channel, chat }), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Check subscription",
              callback_data: "check_subscription",
            },
          ],
        ],
      },
    })
  }

  switch (ctx.dbuser.state) {
    case UserState.WaitNothing: {
      try {
        await getUserProfilePhoto(ctx, ctx.dbuser.id)
      } catch {
        return ctx.reply(ctx.t("mint.no_photo"))
      }
      const author = await ctx.getAuthor()
      if (!author.user.username) {
        return ctx.reply(ctx.t("mint.no_username"))
      }
      ctx.dbuser.name = author.user.username
      if (!ctx.dbuser.votes) {
        ctx.dbuser.votes = BigInt(await voteScore(ctx))
      }
      ctx.dbuser.state = UserState.WaitDescription
      await ctx.dbuser.save()
      await sendWaitDescription(ctx)
      break
    }

    case UserState.WaitDescription: {
      await sendWaitDescription(ctx)
      break
    }

    case UserState.WaitWallet: {
      await ctx.reply(ctx.t("wallet.wait"), {
        link_preview_options: { is_disabled: true },
      })
      break
    }

    case UserState.Submited: {
      await sendPlaceInLine(ctx.api, ctx.dbuser.id, true)
      break
    }

    default: {
      break
    }
  }
}

async function saveDescription(ctx: Context, description: string) {
  ctx.dbuser.description = description
  ctx.dbuser.state = UserState.WaitWallet
  await ctx.dbuser.save()
  await ctx.reply(ctx.t("description.success", { description }))
  await ctx.reply(ctx.t("wallet.wait"), {
    link_preview_options: { is_disabled: true },
  })
}

feature.on("message:text", logHandle("message-handler")).filter(
  ctx => ctx.dbuser.state === UserState.WaitDescription,
  async ctx => {
    if (ctx.message.text.startsWith("/")) {
      return sendWaitDescription(ctx)
    }
    await saveDescription(ctx, ctx.message.text)
  },
)

feature
  .on("callback_query", logHandle("check-subscription-callback-query"))
  .filter(
    (ctx: Context) => ctx.hasCallbackQuery("check_subscription"),
    async ctx => {
      await mintAction(ctx, true)
    },
  )

feature
  .on("callback_query", logHandle("correct_description-callback-query"))
  .filter(
    (ctx: Context) => ctx.hasCallbackQuery("correct_description"),
    async (ctx: Context) => {
      const bio = await getBio(ctx)
      if (bio) {
        await saveDescription(ctx, bio)
        await ctx.deleteMessage()
      } else {
        return ctx.reply("wrong")
      }
    },
  )

feature.on("message:text", logHandle("message-handler")).filter(
  ctx => ctx.dbuser.state === UserState.WaitWallet,
  async ctx => {
    try {
      const address = Address.parse(ctx.message.text)
      const valid = isUserAddressValid(address)
      if (!valid) {
        return ctx.reply(ctx.t("wallet.wait"), {
          link_preview_options: { is_disabled: true },
        })
      }
      const userWithWallet = await findUserByAddress(address)
      if (userWithWallet && ctx.dbuser.id !== userWithWallet.id) {
        return ctx.reply(
          ctx.t("wallet.already_exists", { wallet: address.toString() }),
        )
      }
      ctx.dbuser.wallet = address.toString()
      ctx.dbuser.state = UserState.Submited
      await ctx.dbuser.save()
      await sendPlaceInLine(ctx.api, ctx.dbuser.id, true)
    } catch (error) {
      try {
        await ctx.reply(ctx.t("wallet.wait"), {
          link_preview_options: { is_disabled: true },
        })
      } catch (error_) {
        ctx.logger.error(error_)
      }
      ctx.logger.warn((error as Error).message)
    }
  },
)

feature.command("mint", logHandle("command-mint"), ctx => mintAction(ctx))

export { composer as mintFeature }
