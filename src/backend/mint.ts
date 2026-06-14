import type { MintHandlerDependencies, MintUser } from './mint-handler'
import { ChatGPTAPI } from 'chatgpt'
import {
  ClipGuidancePreset,
  generate,
  SDSampler,
} from '#root/common/helpers/generation'
import { adminIndex } from '#root/common/helpers/telegram'
import {
  countMinted,
  findUserById,
  placeInLine,
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
    name: user.name,
  }
}

function createDefaultDependencies(): MintHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findMintUser: async (id) => {
      const user = await findUserById(id)
      return user ? toMintUser(user) : null
    },
    countMinted,
    queuePosition: placeInLine,
    floorParams: () => ({
      base: BigInt(config.MINT_FLOOR_BASE_VOTES),
      step: BigInt(config.MINT_FLOOR_STEP_VOTES),
      cap: BigInt(config.MINT_FLOOR_CAP_VOTES),
    }),
    // Semi-auto pixel-art generation from the user's avatar (Stability AI).
    generateImage: async (user) => {
      if (!user.avatar) throw new Error('No avatar to generate from')
      return generate(
        user.avatar,
        adminIndex(user.id),
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
      // Queue for admin review; also clears a prior Rework return.
      user.state = UserState.Submited
      await user.save()
    },
    logError: (message) => logger.error(message),
  }
}

const mintHandler = buildMintHandler(createDefaultDependencies())

export default mintHandler
