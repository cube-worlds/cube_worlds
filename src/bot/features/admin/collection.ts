import type { Context } from '#root/bot/context.js'
import { isAdmin } from '#root/bot/filters/is-admin.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { NftCollection } from '#root/bot/helpers/nft-collection.js'
import { openWallet, waitSeqno } from '#root/bot/helpers/ton.js'
import { config } from '#root/config.js'
import { chatAction } from '@grammyjs/auto-chat-action'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command(
  'collection',
  logHandle('command-collection'),
  chatAction('upload_document'),
  async (ctx) => {
    if (config.COLLECTION_ADDRESS) {
      return ctx.reply('Collection already deployed!')
    }
    const wallet = await openWallet(config.MNEMONICS!.split(' '))
    const collectionData = {
      ownerAddress: wallet.contract.address,
      royaltyPercent: 0.49,
      royaltyAddress: wallet.contract.address,
      nextItemIndex: 0,
      collectionContentUrl: '',
      commonContentUrl: '',
    }
    const collection = new NftCollection(collectionData)
    const seqno = await collection.deploy(wallet)
    ctx.logger.info(`Collection will be deployed at: ${collection.address}`)
    await waitSeqno(seqno, wallet)
    await ctx.reply(`Collection deployed: ${collection.address}`)
  },
)

export { composer as collectionFeature }
