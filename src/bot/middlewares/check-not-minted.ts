import { Api, Middleware, RawApi } from "grammy";
import { config } from "#root/config";
import { Context } from "../context";
import { i18n } from "../i18n";

export function sendMintedMessage(
  api: Api<RawApi>,
  userId: number,
  userLocale: string,
  nftUrl: string,
) {
  const collectionOwner = config.COLLECTION_OWNER;
  const url = `https://t.me/${config.BOT_NAME}?start=${userId}`;
  const shareLink = `https://t.me/share/url?url=${url}&text=${i18n.t(userLocale, "mint.share")}`;
  return api.sendMessage(
    userId,
    i18n.t(userLocale, "queue.success", { nftUrl, collectionOwner, shareLink }),
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
