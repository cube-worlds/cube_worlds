import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { config } from "#root/config.js";
import {
  UserState,
  findUserByAddress,
  placeInLine,
} from "#root/bot/models/user.js";
import { getUserProfilePhoto } from "#root/bot/helpers/photo.js";
import { Address } from "@ton/core";
import { voteScore } from "#root/bot/helpers/votes.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

async function isUserSubscribed(
  ctx: Context,
  channel: string,
): Promise<boolean> {
  const subscriber = await ctx.api.getChatMember(channel, ctx.dbuser.id);
  const validStatuses = ["creator", "administrator", "member"];
  return validStatuses.includes(subscriber.status);
}

async function mintAction(
  ctx: Context,
  removeSubscriptionCheckMessage: boolean = false,
) {
  if (ctx.dbuser.minted) {
    const url = ctx.dbuser.nftUrl ?? "";
    return ctx.reply(ctx.t("queue.success", { url }));
  }

  const channel = config.TELEGRAM_CHANNEL;
  const isSubscribed = await isUserSubscribed(ctx, channel);
  if (isSubscribed) {
    if (removeSubscriptionCheckMessage) {
      ctx.deleteMessage();
    }
  } else {
    return ctx.reply(ctx.t("subscribe_required", { channel }), {
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
    });
  }

  switch (ctx.dbuser.state) {
    case UserState.WaitNothing: {
      try {
        await getUserProfilePhoto(ctx, ctx.dbuser.id);
      } catch {
        return ctx.reply(ctx.t("no_photo"));
      }
      const author = await ctx.getAuthor();
      if (!author.user.username) {
        return ctx.reply(ctx.t("no_username"));
      }
      ctx.dbuser.name = author.user.username;
      ctx.dbuser.votes = await voteScore(ctx);
      ctx.dbuser.state = UserState.WaitDescription;
      ctx.dbuser.save();
      ctx.reply(ctx.t("description.wait"));
      break;
    }
    case UserState.WaitDescription: {
      ctx.reply(ctx.t("description.wait"));
      break;
    }
    case UserState.WaitWallet: {
      ctx.reply(ctx.t("wallet.wait"), {
        link_preview_options: { is_disabled: true },
      });
      break;
    }
    case UserState.Submited: {
      const place = await placeInLine(ctx.dbuser.votes);
      ctx.reply(
        ctx.t("speedup", {
          place,
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.dbuser.id}`,
          collectionOwner: config.COLLECTION_OWNER,
        }),
      );
      break;
    }
    default: {
      break;
    }
  }
}

function isAddressValid(a: Address): boolean {
  try {
    return a.workChain === 0 || a.workChain === -1;
  } catch {
    return false;
  }
}

feature.on("message:text", logHandle("message-handler")).filter(
  (ctx) => ctx.dbuser.state === UserState.WaitDescription,
  async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      return ctx.reply(ctx.t("description.wait"));
    }
    ctx.dbuser.description = ctx.message.text;
    ctx.dbuser.state = UserState.WaitWallet;
    ctx.dbuser.save();
    await ctx.reply(
      ctx.t("description.success", { description: ctx.message.text }),
    );
    ctx.reply(ctx.t("wallet.wait"), {
      link_preview_options: { is_disabled: true },
    });
  },
);

feature
  .on("callback_query", logHandle("check-subscription-callback-query"))
  .filter(
    (ctx) => ctx.hasCallbackQuery("check_subscription"),
    async (ctx) => {
      mintAction(ctx, true);
    },
  );

feature.on("message:text", logHandle("message-handler")).filter(
  (ctx) => ctx.dbuser.state === UserState.WaitWallet,
  async (ctx) => {
    try {
      const address = Address.parse(ctx.message.text);
      const valid = isAddressValid(address);
      if (!valid) {
        return ctx.reply(ctx.t("wallet.incorrect"));
      }
      const alreadyExistedWallet = await findUserByAddress(address);
      if (alreadyExistedWallet) {
        return ctx.reply(
          ctx.t("wallet.already_exists", { wallet: address.toString() }),
        );
      }
      ctx.dbuser.wallet = address.toString();
      ctx.dbuser.state = UserState.Submited;
      ctx.dbuser.save();
      const place = await placeInLine(ctx.dbuser.votes);
      ctx.reply(
        ctx.t("speedup", {
          place,
          inviteLink: `https://t.me/${ctx.me.username}?start=${ctx.chat.id}`,
          collectionOwner: config.COLLECTION_OWNER,
        }),
      );
    } catch (error) {
      ctx.reply(ctx.t("wallet.incorrect"));
      ctx.logger.warn((error as Error).message);
    }
  },
);

feature.command("mint", logHandle("command-mint"), (ctx) => mintAction(ctx));

export { composer as mintFeature };
