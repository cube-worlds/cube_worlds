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
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  addPoints,
  claimUserForMint,
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

// Build the chain/IPFS-backed approval deps bound to this admin's context.
function approvalDependencies(ctx: Context): QueueApprovalDependencies {
  const admIndex = adminIndex(ctx.dbuser.id)
  return {
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
    // Credit the inviter once the invitee's pass is minted (human-gated, so
    // the reward can't be farmed with throwaway accounts).
    rewardReferrer: async (user) => {
      const reward = BigInt(config.REFERRAL_MINT_REWARD_VOTES)
      if (reward <= 0n) return
      const invitee = await findUserById(user.id)
      const referrerId = invitee?.referalId
      if (!referrerId) return
      await addPoints(referrerId, reward, BalanceChangeType.Referral)
      try {
        await ctx.api.sendMessage(
          referrerId,
          `🎁 ${user.name ? `@${user.name}` : 'A friend you invited'} minted their pass — +${reward} $CUBE for you!`,
        )
      } catch {
        // referrer blocked the bot — the credit still stands
      }
    },
    notifyApproved: async (user, nftUrl) => {
      await ctx.api.sendMessage(
        user.id,
        `🎉 Your NFT has been minted! ${nftUrl}`,
      )
      await ctx.reply(`✅ Minted for @${user.name}: ${nftUrl}`)
    },
    notifyDeclined: async (user) => {
      await ctx.api.sendMessage(
        user.id,
        '❌ Your NFT draft was declined. Open the app to generate a new one and resubmit.',
      )
      await ctx.reply(`❌ Declined @${user.name}`)
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

      const { approve, decline } = buildQueueApproval(
        approvalDependencies(ctx),
      )

      if (action === MintAction.Approve) {
        await ctx.reply('💥 Mint started!')
        const result = await approve(approvalUser)
        if (!result.ok) await ctx.reply(`🚫 Approve failed: ${result.reason}`)
      } else if (action === MintAction.Decline) {
        const result = await decline(approvalUser)
        if (!result.ok) await ctx.reply(`🚫 Decline failed: ${result.reason}`)
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
