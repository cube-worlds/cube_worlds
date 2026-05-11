import type { Context } from '#root/bot/context'
import type { Api, MiddlewareFn, RawApi } from 'grammy'
import {
  inviteTelegramUrl,
  shareTelegramLink,
} from '#root/common/helpers/telegram'
import { i18n } from '#root/common/i18n'
import { config } from '#root/config'

export interface CheckNotMintedDependencies {
  sendMintedMessage: (
    api: Api<RawApi>,
    userId: number,
    userLocale: string,
    nftUrl: string,
  ) => Promise<unknown>
}

export async function sendMintedMessage(
  api: Api<RawApi>,
  userId: number,
  userLocale: string,
  nftUrl: string,
) {
  const shareLink = shareTelegramLink(userId, i18n.t(userLocale, 'mint.share'))
  const inviteLink = inviteTelegramUrl(userId)
  await api.sendMessage(
    userId,
    `${i18n.t(userLocale, 'queue.minted', {
      nftUrl,
    })}

${i18n.t(userLocale, 'speedup.variants', {
  shareLink,
  inviteLink,
  collectionOwner: config.COLLECTION_OWNER,
})}`,
    {
      link_preview_options: { is_disabled: true },
    },
  )
}

export function buildCheckNotMinted(
  deps: CheckNotMintedDependencies = { sendMintedMessage },
): MiddlewareFn<Context> {
  return (ctx, next) => {
    if (ctx.dbuser.minted) {
      return deps.sendMintedMessage(
        ctx.api,
        ctx.dbuser.id,
        ctx.dbuser.language,
        ctx.dbuser.nftUrl ?? '',
      )
    }
    return next()
  }
}

export function checkNotMinted(): MiddlewareFn<Context> {
  return buildCheckNotMinted()
}
