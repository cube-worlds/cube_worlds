import { Middleware } from "grammy";
import { config } from "#root/config";
import { Context } from "../context";

export function sendMintedMessage(ctx: Context) {
  const nftUrl = ctx.dbuser.nftUrl ?? "";
  const collectionOwner = config.COLLECTION_OWNER;
  const text = ctx.t("mint.share");
  const shareLink = `https://t.me/share/url?url=https://t.me/${config.BOT_NAME}&text=${text}`;
  return ctx.reply(
    ctx.t("queue.success", { nftUrl, collectionOwner, shareLink }),
    {
      link_preview_options: { is_disabled: true },
    },
  );
}

export function checkNotMinted(): Middleware<Context> {
  return (ctx, next) => {
    if (ctx.dbuser.minted) {
      return sendMintedMessage(ctx);
    }
    return next();
  };
}
