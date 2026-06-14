import type { Context } from '#root/bot/context'
import type { User, UserDoc } from '#root/common/models/User'
import { Menu } from '@grammyjs/menu'
import { InputFile } from 'grammy'
import { MintAction, mintActionData } from '#root/bot/callback-data/mint-action'
import { linkToIPFSGateway } from '#root/common/helpers/ipfs'
import { eligibleQueue } from '#root/common/models/User'
import { config } from '#root/config'

export function photoCaption(user: User) {
  return `@[${user.name}](tg://user?id=${user.id})

Comment: \`${`${user.description?.slice(0, user.nftDescription ? 100 : 700) ?? ''}${user.nftDescription ? '...' : ''}`}\`

Description: \`${user.nftDescription ?? ''}\`
${user.nftImage ? `[Image](${linkToIPFSGateway(user.nftImage)}) | ` : ''} ${user.nftJson ? `[JSON](${linkToIPFSGateway(user.nftJson)})` : ''}

Minted: ${user.minted ? '✅' : '❌'} ${user.nftUrl ? `[NFT](${user.nftUrl})` : ''}
`
}

// Admin-facing keyboard: exactly two actions, Approve / Return-to-work.
function approveReturnKeyboard(userId: number) {
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
          text: '↩️ Return to work',
          callback_data: mintActionData.pack({
            action: MintAction.Return,
            userId,
          }),
        },
      ],
    ],
  }
}

// Send the auto-generated draft (image + description) with the two-button
// Approve/Return keyboard. The image was produced in the webview (user.image).
export async function sendQueueEntry(context: Context, user: UserDoc) {
  const caption = photoCaption(user)
  const reply_markup = approveReturnKeyboard(user.id)
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

function floorParamsFromConfig() {
  return {
    base: BigInt(config.MINT_FLOOR_BASE_VOTES),
    step: BigInt(config.MINT_FLOOR_STEP_VOTES),
    cap: BigInt(config.MINT_FLOOR_CAP_VOTES),
  }
}

// Lists only eligible (votes ≥ floor), un-minted, Submited users, ranked by
// votes desc; clicking one opens its draft with Approve / Return.
export const queueMenu = new Menu('queue').dynamic(async (_ctx, range) => {
  const users = await eligibleQueue(floorParamsFromConfig())
  for (const user of users) {
    range
      .text(`(${user.votes}) ${user.name ?? user.wallet}`, async (ctx) => {
        await sendQueueEntry(ctx as unknown as Context, user)
      })
      .row()
  }
})
