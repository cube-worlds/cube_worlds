import type { Context } from '#root/bot/context'
import type { User, UserDoc } from '#root/common/models/User'
import { Menu } from '@grammyjs/menu'
import { InputFile } from 'grammy'
import { MintAction, mintActionData } from '#root/bot/callback-data/mint-action'
import { linkToIPFSGateway } from '#root/common/helpers/ipfs'
import { findQueue } from '#root/common/models/User'

export function photoCaption(user: User) {
  return `@[${user.name}](tg://user?id=${user.id})

Comment: \`${`${user.description?.slice(0, user.nftDescription ? 100 : 700) ?? ''}${user.nftDescription ? '...' : ''}`}\`

Description: \`${user.nftDescription ?? ''}\`
${user.nftImage ? `[Image](${linkToIPFSGateway(user.nftImage)}) | ` : ''} ${user.nftJson ? `[JSON](${linkToIPFSGateway(user.nftJson)})` : ''}

Minted: ${user.minted ? '✅' : '❌'} ${user.nftUrl ? `[NFT](${user.nftUrl})` : ''}
`
}

// Admin-facing keyboard: exactly two actions, Approve / Decline. Shared by the
// /queue browser and the push notification sent on user submit.
export function approveDeclineKeyboard(userId: number) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Approve',
          callback_data: mintActionData.pack({
            action: MintAction.Approve,
            userId,
          }),
        },
        {
          text: '❌ Decline',
          callback_data: mintActionData.pack({
            action: MintAction.Decline,
            userId,
          }),
        },
      ],
    ],
  }
}

// Send the submitted draft (image + description) with the two-button
// Approve/Decline keyboard. The image was produced in the webview (user.image).
export async function sendQueueEntry(context: Context, user: UserDoc) {
  const caption = photoCaption(user)
  const reply_markup = approveDeclineKeyboard(user.id)
  if (user.image) {
    const photo = user.image.startsWith('http')
      ? user.image
      : new InputFile(user.image)
    await context.replyWithPhoto(photo, {
      caption,
      parse_mode: 'Markdown',
      reply_markup,
    })
  } else {
    await context.reply(caption, { parse_mode: 'Markdown', reply_markup })
  }
}

// Lists un-minted Submited users, ranked by votes desc; clicking one opens its
// draft with Approve / Decline.
export const queueMenu = new Menu('queue').dynamic(async (_ctx, range) => {
  const users = await findQueue()
  for (const user of users) {
    range
      .text(`(${user.votes}) ${user.name ?? user.wallet}`, async (ctx) => {
        await sendQueueEntry(ctx as unknown as Context, user)
      })
      .row()
  }
})
