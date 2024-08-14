import { Api, Middleware, RawApi } from "grammy"
import { config } from "#root/config"
import { Context } from "#root/bot/context.js"
import { i18n } from "#root/bot/i18n.js"
import { inviteTelegramUrl, shareTelegramLink } from "#root/bot/helpers/telegram.js"

export async function sendMintedMessage(
  api: Api<RawApi>,
  userId: number,
  userLocale: string,
  nftUrl: string,
) {
  const shareLink = shareTelegramLink(userId, i18n.t(userLocale, "mint.share"))
  const inviteLink = inviteTelegramUrl(userId)
  await api.sendMessage(
    userId,
    `${i18n.t(userLocale, "queue.minted", {
      nftUrl,
    })}

${i18n.t(userLocale, "speedup.variants", {
  shareLink,
  inviteLink,
  collectionOwner: config.COLLECTION_OWNER,
})}`,
    {
      link_preview_options: { is_disabled: true },
    },
  )
}

export function checkNotMinted(): Middleware<Context> {
  return (ctx, next) => {
    if (ctx.dbuser.minted) {
      return sendMintedMessage(ctx.api, ctx.dbuser.id, ctx.dbuser.language, ctx.dbuser.nftUrl ?? "")
    }
    return next()
  }
}
