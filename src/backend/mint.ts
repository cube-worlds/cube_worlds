import type { Api } from 'grammy'
import type { MintHandlerDependencies, MintUser } from './mint-handler'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ChatGPTAPI } from 'chatgpt'
import { InputFile } from 'grammy'
import { approveDeclineKeyboard } from '#root/bot/keyboards/queue-menu'
import {
  ClipGuidancePreset,
  generate,
  SDSampler,
} from '#root/common/helpers/generation'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  addPoints,
  debitVotes,
  findUserById,
  UserState,
} from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { buildMintHandler } from './mint-handler'

function toMintUser(user: NonNullable<Awaited<ReturnType<typeof findUserById>>>): MintUser {
  return {
    id: user.id,
    votes: user.votes,
    state: user.state,
    minted: user.minted,
    nftUrl: user.nftUrl,
    image: user.image,
    description: user.nftDescription,
    avatar: user.avatar,
    wallet: user.wallet,
    name: user.name,
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

async function readImageDataUrl(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath)
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function adminCaption(user: MintUser): string {
  const name = user.name ? `@${user.name}` : String(user.id)
  return [
    '🖼 Mint request',
    `User: ${name} (${user.id})`,
    `Votes: ${user.votes}`,
    `Wallet: ${user.wallet ?? '—'}`,
    '',
    user.description ?? '',
  ].join('\n')
}

function createDefaultDependencies(api: Api): MintHandlerDependencies {
  const tryCost = () => BigInt(config.GENERATION_TRY_COST_VOTES)
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findMintUser: async (id) => {
      const user = await findUserById(id)
      return user ? toMintUser(user) : null
    },
    tryCost,
    debitTry: (userId) =>
      debitVotes(userId, tryCost(), BalanceChangeType.Generation),
    refundTry: async (userId) => {
      await addPoints(userId, tryCost(), BalanceChangeType.Generation)
    },
    // Semi-auto pixel-art generation from the user's chosen avatar (Stability AI).
    generateImage: async (user) => {
      if (!user.avatar) throw new Error('No avatar to generate from')
      return generate(
        user.avatar,
        0,
        user.name ?? String(user.id),
        '',
        '',
        0.35,
        7,
        30,
        ClipGuidancePreset.NONE,
        SDSampler.K_DPMPP_2S_ANCESTRAL,
      )
    },
    // Auto description (ChatGPT) from the user's name + provided info.
    generateDescription: async (user) => {
      const api = new ChatGPTAPI({
        apiKey: config.OPENAI_API_KEY,
        completionParams: { max_tokens: 512 },
      })
      const name = user.name ?? ''
      const info = user.description ?? ''
      const result = await api.sendMessage(
        `Write an inspiring text about a person named "${name}" who has decided to start a journey.
        You could also use additional information: "${info}", if it feels appropriate, and translate into English if not.
        Result should NOT contains terms in original language and "embarking" word. TEXT MUST BE ONLY IN ENGLISH.
        Remove any links. NOT use any quotation marks.
        Response MUST BE up to 500 characters maximum`,
      )
      return result.text.slice(0, 700)
    },
    persistDraft: async (userId, image, description) => {
      const user = await findUserById(userId)
      if (!user) throw new Error('User not found')
      user.image = image
      user.nftDescription = description
      // A fresh draft is private until the user submits it; this also clears a
      // prior admin decline (Rework).
      user.state = UserState.WaitNothing
      await user.save()
    },
    submitDraft: async (userId) => {
      const user = await findUserById(userId)
      if (!user) throw new Error('User not found')
      user.state = UserState.Submited
      await user.save()
    },
    // Push the submitted draft to every admin with Approve / Decline buttons.
    notifyAdmins: async (user) => {
      if (!user.image) throw new Error('No draft image to send')
      const caption = adminCaption(user)
      const reply_markup = approveDeclineKeyboard(user.id)
      for (const adminId of config.BOT_ADMINS) {
        const photo = user.image.startsWith('http')
          ? user.image
          : new InputFile(user.image)
        await api.sendPhoto(adminId, photo, { caption, reply_markup })
      }
    },
    readImageDataUrl,
    logError: (message) => logger.error(message),
  }
}

export function createMintHandler(api: Api) {
  return buildMintHandler(createDefaultDependencies(api))
}
