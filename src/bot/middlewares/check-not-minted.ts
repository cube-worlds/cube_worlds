import { Api, Middleware, RawApi } from "grammy";
import { config } from "#root/config";
import { Context } from "../context";
import { i18n } from "../i18n";
import { shareTelegramLink } from "../helpers/telegram";

export async function sendMintedMessage(
  api: Api<RawApi>,
  userId: number,
  userLocale: string,
  nftUrl: string,
) {
  const collectionOwner = config.COLLECTION_OWNER;
  const shareLink = shareTelegramLink(userId, i18n.t(userLocale, "mint.share"));
  await api.sendMessage(
    userId,
    i18n.t(userLocale, "queue.success", {
      nftUrl,
      collectionOwner,
      shareLink,
    }),
    {
      link_preview_options: { is_disabled: true },
    },
  );
}

export function checkNotMinted(): Middleware<Context> {
  return (ctx, next) => {
    if (ctx.dbuser.minted) {
      return sendMintedMessage(
        ctx.api,
        ctx.dbuser.id,
        ctx.dbuser.language,
        ctx.dbuser.nftUrl ?? "",
      );
    }
    return next();
  };
}
