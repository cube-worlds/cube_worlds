import type { Context } from '#root/bot/context.js'
import { isAdmin } from '#root/bot/filters/is-admin.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { openWallet, topUpBalance, waitSeqno } from '#root/bot/helpers/ton.js'
import { config } from '#root/config.js'
import { chatAction } from '@grammyjs/auto-chat-action'
import { Address } from '@ton/core'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('topup', logHandle('command-topup'), chatAction('upload_document'), async (ctx) => {
  const wallet = await openWallet(config.MNEMONICS!.split(' '))
  const collectionAddress = Address.parse(config.COLLECTION_ADDRESS)
  const seqno = await topUpBalance(wallet, collectionAddress, 10)
  ctx.logger.info(`Collection ${collectionAddress} will be topUpped`)
  await waitSeqno(seqno, wallet)
  await ctx.reply(`Collection ${collectionAddress} topUpped!`)
})

export { composer as topupFeature }
