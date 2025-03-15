import type { Context } from '#root/bot/context.js'
import type { User } from '#root/bot/models/user.js'
import type { DocumentType } from '@typegoose/typegoose'
import { saveImageFromUrl } from '#root/bot/helpers/files.js'
import { getUserProfileFile } from '#root/bot/helpers/photo.js'
import { photoKeyboard } from '#root/bot/keyboards/photo.js'
import { findQueue, findUserById, UserState } from '#root/bot/models/user.js'
import { config } from '#root/config.js'
import { logger } from '#root/logger'
import { Menu } from '@grammyjs/menu'
import { linkToIPFSGateway } from '../helpers/ipfs'
import { adminIndex } from '../helpers/telegram'
import { i18n } from '../i18n'

export function photoCaption(user: User) {
  return `@[${user.name}](tg://user?id=${user.id})

Comment: \`${`${user.description?.slice(0, user.nftDescription ? 100 : 700) ?? ''}${user.nftDescription ? '...' : ''}`}\`

Description: \`${user.nftDescription ?? ''}\`
${user.nftImage ? `[Image](${linkToIPFSGateway(user.nftImage)}) | ` : ''} ${user.nftJson ? `[JSON](${linkToIPFSGateway(user.nftJson)})` : ''}

Minted: ${user.minted ? '✅' : '❌'} ${user.nftUrl ? `[NFT](${user.nftUrl})` : ''}
`
}

export async function sendUserMetadata(context: Context, selectedUser: DocumentType<User>) {
  context.chatAction = 'upload_document'

  const adminUser = context.dbuser
  const selectedUserId: number = selectedUser.id
  adminUser.selectedUser = selectedUser.id
  await adminUser.save()

  try {
    const nextAvatar = await getUserProfileFile(
      context,
      selectedUserId,
      adminUser.avatarNumber ?? 0,
    )
    if (!nextAvatar) {
      return context.reply(context.t('wrong'))
    }
    const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${nextAvatar.file_path}`

    const admIndex = adminIndex(context.dbuser.id)
    const username = selectedUser.name
    if (!username)
      return context.reply('Empty username')

    selectedUser.avatar = await saveImageFromUrl(photoUrl, admIndex, username, true)
    await selectedUser.save()

    await context.replyWithPhoto(nextAvatar.file_id, {
      caption: photoCaption(selectedUser),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: photoKeyboard,
      },
    })
  }
  catch (error) {
    const errorMessage = (error as Error).message
    if (errorMessage === 'No profile avatars') {
      selectedUser.state = UserState.WaitNothing
      await selectedUser.save()
      const message = `❌ ${i18n.t(selectedUser.language, 'queue.no_photo_after_submit')}`
      await context.api.sendMessage(selectedUser.id, message)
      await context.api.sendMessage(adminUser.id, message)
    }
    else if (errorMessage === 'No square photos') {
      selectedUser.state = UserState.WaitNothing
      await selectedUser.save()
      const message = `❌ ${i18n.t(selectedUser.language, 'queue.no_square_avatars')}`
      await context.api.sendMessage(selectedUser.id, message)
      await context.api.sendMessage(adminUser.id, message)
    }
    else if (errorMessage.startsWith('Call to \'getFile\' failed!')) {
      const nextAvatarNumber
        = context.dbuser.selectedUser === selectedUser.id
          ? (context.dbuser.avatarNumber ?? -1) + 1
          : 0
      context.dbuser.avatarNumber = nextAvatarNumber
      await context.dbuser.save()
      return context.reply('Avatar is unavailable, trying to change it')
    }
    else {
      logger.error(error)
      return context.reply(context.t('wrong'))
    }
  }
}

export const queueMenu = new Menu('queue').dynamic(async (cntxt, range) => {
  const adminUser = await findUserById((cntxt as Context).dbuser.id)
  if (!adminUser) {
    return []
  }
  const users = await findQueue()
  const usersWithAdmin = [...users, adminUser]
  for (const user of usersWithAdmin) {
    range
      .text(
        `(${user.diceWinner ? `🎲 ${user.votes}` : user.votes}) ${user.name ?? user.wallet}`,
        async (ctx) => {
          const context = ctx as unknown as Context
          const author = await ctx.api.getChatMember(user.id, user.id)

          if (author.user.username !== user.name) {
            const oldUsername = user.name
            user.name = author.user.username
            await user.save()
            return ctx.reply(`Username changed from @${oldUsername} to @${user.name}`)
          }

          await sendUserMetadata(context, user)
        },
      )
      .row()
  }
})
