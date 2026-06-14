import type { Context } from '#root/bot/context'
import type { NFTMintParameters } from '#root/common/helpers/nft-item'
import type {
  ApprovalUser,
  QueueApprovalDependencies,
} from './queue-approval-handler'
import { Address, toNano } from '@ton/core'
import { Composer } from 'grammy'
import { MintAction, mintActionData } from '#root/bot/callback-data/mint-action'
import { isAdmin } from '#root/bot/filters/is-admin'
import { queueMenu } from '#root/bot/keyboards/queue-menu'
import { randomAttributes } from '#root/common/helpers/attributes'
import {
  pinImageURLToIPFS,
  pinJSONToIPFS,
} from '#root/common/helpers/ipfs'
import { logHandle } from '#root/common/helpers/logging'
import { NftCollection } from '#root/common/helpers/nft-collection'
import { NftItem } from '#root/common/helpers/nft-item'
import { adminIndex } from '#root/common/helpers/telegram'
import {
  claimUserForMint,
  countMinted,
  countUsers,
  findUserById,
  markUserMinted,
  releaseMintClaim,
  setUserRework,
} from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { buildQueueApproval } from './queue-approval-handler'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('queue', logHandle('command-queue'), async (ctx) => {
  const count = await countUsers(false)
  return ctx.reply(ctx.t('queue.title', { count }), {
    reply_markup: queueMenu,
  })
})

function floorParamsFromConfig() {
  return {
    base: BigInt(config.MINT_FLOOR_BASE_VOTES),
    step: BigInt(config.MINT_FLOOR_STEP_VOTES),
    cap: BigInt(config.MINT_FLOOR_CAP_VOTES),
  }
}

// Build the chain/IPFS-backed approval deps bound to this admin's context.
function approvalDependencies(ctx: Context): QueueApprovalDependencies {
  const admIndex = adminIndex(ctx.dbuser.id)
  return {
    floorParams: floorParamsFromConfig,
    countMinted,
    claimForMint: claimUserForMint,
    releaseClaim: releaseMintClaim,
    pinToIpfs: async (user) => {
      const username = user.name ?? String(user.id)
      const imageHash = await pinImageURLToIPFS(
        admIndex,
        username,
        user.image ?? '',
      )
      const json = {
        name: user.name,
        description: user.nftDescription,
        image: `ipfs://${imageHash}`,
        attributes: randomAttributes(),
      }
      const jsonHash = await pinJSONToIPFS(admIndex, username, json)
      return { imageHash, jsonHash }
    },
    mintOnChain: async (user, jsonHash) => {
      const nextItemIndex = await NftCollection.fetchNextItemIndexWithRetry()
      const parameters: NFTMintParameters = {
        queryId: 0,
        itemOwnerAddress: Address.parse(user.wallet ?? ''),
        itemIndex: nextItemIndex,
        amount: toNano('0.01'),
        commonContentUrl: `ipfs://${jsonHash}`,
      }
      return new NftItem().deployNFT(parameters)
    },
    markMinted: markUserMinted,
    setRework: setUserRework,
    notifyApproved: async (user, nftUrl) => {
      await ctx.api.sendMessage(
        user.id,
        `🎉 Your NFT has been minted! ${nftUrl}`,
      )
      await ctx.reply(`✅ Minted for @${user.name}: ${nftUrl}`)
    },
    notifyReturned: async (user) => {
      await ctx.api.sendMessage(
        user.id,
        '↩️ Your NFT draft was returned. Open the app to regenerate it.',
      )
      await ctx.reply(`↩️ Returned @${user.name} to work`)
    },
    logError: (message) => logger.error(message),
  }
}

feature.callbackQuery(
  mintActionData.filter(),
  logHandle('keyboard-mint-action'),
  async (ctx: Context) => {
    try {
      const { action, userId } = mintActionData.unpack(
        ctx.callbackQuery?.data ?? '',
      )
      const user = await findUserById(userId)
      if (!user) return ctx.reply(ctx.t('wrong'))
      try {
        await ctx.editMessageReplyMarkup()
      } catch {
        // message too old to edit — ignore
      }

      const approvalUser: ApprovalUser = {
        id: user.id,
        name: user.name,
        wallet: user.wallet,
        votes: user.votes,
        minted: user.minted,
        image: user.image,
        nftDescription: user.nftDescription,
      }

      const { approve, returnToWork } = buildQueueApproval(
        approvalDependencies(ctx),
      )

      if (action === MintAction.Approve) {
        await ctx.reply('💥 Mint started!')
        const result = await approve(approvalUser)
        if (!result.ok) await ctx.reply(`🚫 Approve failed: ${result.reason}`)
      } else if (action === MintAction.Return) {
        const result = await returnToWork(approvalUser)
        if (!result.ok) await ctx.reply(`🚫 Return failed: ${result.reason}`)
      }
    } catch (error) {
      ctx.logger.error(error)
      const { message } = error as Error
      await (message ? ctx.reply(`Error: ${message}`) : ctx.reply(ctx.t('wrong')))
    }
    ctx.chatAction = null
  },
)

export { composer as queueFeature }
