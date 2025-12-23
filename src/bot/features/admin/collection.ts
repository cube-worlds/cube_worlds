import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { NftCollection } from '#root/common/helpers/nft-collection'
import { openWallet, waitSeqno } from '#root/common/helpers/ton'
import { config } from '#root/config'
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
