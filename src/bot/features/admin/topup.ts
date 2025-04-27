import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { openWallet, topUpBalance, waitSeqno } from '#root/common/helpers/ton'
import { config } from '#root/config'
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
