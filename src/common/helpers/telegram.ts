import type { TranslationVariables } from '@grammyjs/i18n'
import type { ReactionTypeEmoji } from '@grammyjs/types'
import type { Api, RawApi } from 'grammy'
import type { UserDoc } from '#root/common/models/User'
import { InputMediaBuilder } from 'grammy'
import { i18n } from '#root/common/i18n'
import {
  findMintedWithDate,
  findQueue,
  findUserById,
  placeInLine,
} from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { getRandomCoolEmoji } from './emoji'
import { linkToIPFSGateway } from './ipfs'
import { commaSeparatedNumber } from './numbers'

export interface Languages {
  ru: string
  en: string
}

export function pickLangValue(lang: string, langMap: Languages): string {
  return lang === 'ru' ? langMap.ru : langMap.en
}

export function findAdminIndex(
  userId: number,
  admins: readonly number[],
): number {
  const index = admins.indexOf(userId)
  if (index < 0) {
    throw new Error('Not admin')
  }
  return index
}

export function buildInviteUrl(botName: string, userId: number): string {
  return `https://t.me/${botName}?start=${userId}`
}

export function buildShareLink(inviteUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURI(inviteUrl)}&text=${encodeURIComponent(text)}`
}

export function pickEnvChats(isProd: boolean): Languages {
  return isProd
    ? { ru: '@cube_worlds_chat_ru', en: '@cube_worlds_chat' }
    : { ru: '@viz_cx', en: '@viz_cx' }
}

export function pickEnvChannels(isProd: boolean): Languages {
  return isProd
    ? { ru: '@cube_worlds_ru', en: '@cube_worlds' }
    : { ru: '@viz_blockchain', en: '@viz_blockchain' }
}

function getCubeChats(): Languages {
  return pickEnvChats(config.isProd)
}

function getCubeChannels(): Languages {
  return pickEnvChannels(config.isProd)
}

export function getCubeChat(lang: string): string {
  return pickLangValue(lang, getCubeChats())
}

export function getCubeChannel(lang: string): string {
  return pickLangValue(lang, getCubeChannels())
}

export function adminIndex(userId: number): number {
  return findAdminIndex(userId, config.BOT_ADMINS)
}

export function inviteTelegramUrl(userId: number) {
  return buildInviteUrl(config.BOT_NAME, userId)
}

export function shareTelegramLink(userId: number, text: string): string {
  return buildShareLink(inviteTelegramUrl(userId), text)
}

export interface PlaceInLineSenderDependencies {
  findUserById: (id: number) => Promise<UserDoc | null>
  placeInLine: (votes: bigint) => Promise<number | null | undefined>
  translate: (
    lang: string,
    key: string,
    vars?: TranslationVariables<string>,
  ) => string
  info: (message: string) => void
  buildInviteUrl: (userId: number) => string
  buildShareLink: (userId: number, text: string) => string
  collectionOwner: string
}

function createDefaultPlaceInLineSenderDependencies(): PlaceInLineSenderDependencies {
  return {
    findUserById,
    placeInLine,
    translate: (lang, key, vars) => i18n.t(lang, key, vars),
    info: (msg) => logger.info(msg),
    buildInviteUrl: inviteTelegramUrl,
    buildShareLink: shareTelegramLink,
    get collectionOwner() {
      return config.COLLECTION_OWNER
    },
  }
}

type PlaceInLineApi = Pick<Api<RawApi>, 'sendMessage'>

export function buildPlaceInLineSender(
  deps: PlaceInLineSenderDependencies = createDefaultPlaceInLineSenderDependencies(),
) {
  return async function sendPlaceInLine(
    api: PlaceInLineApi,
    userId: number,
    sendAnyway = true,
  ): Promise<boolean> {
    const user = await deps.findUserById(userId)
    if (!user) {
      return false
    }
    const place = (await deps.placeInLine(user.votes)) ?? 0
    const lastSendedPlace = user.lastSendedPlace ?? Number.MAX_SAFE_INTEGER
    const placeDecreased = place < lastSendedPlace
    if (sendAnyway || placeDecreased) {
      const inviteLink = deps.buildInviteUrl(user.id)
      const shareLink = deps.buildShareLink(
        user.id,
        deps.translate(user.language, 'mint.share'),
      )
      const titleKey = `speedup.${user.minted ? 'title_minted' : 'title_not_minted'}`
      const titleVariables: TranslationVariables<string> = {
        points: commaSeparatedNumber(user.votes),
      }
      await api.sendMessage(
        user.id,
        `${deps.translate(user.language, titleKey, titleVariables)}

${deps.translate(user.language, 'speedup.variants', {
  shareLink,
  inviteLink,
  collectionOwner: deps.collectionOwner,
})}`,
      )

      user.lastSendedPlace = place
      await user.save()
      deps.info(`Points ${user.votes} for user ${user.id}`)
      return true
    }
    return false
  }
}

export const sendPlaceInLine = buildPlaceInLineSender()

type SendPhotoApi = Pick<Api<RawApi>, 'sendPhoto'>
type SendMessageApi = Pick<Api<RawApi>, 'sendMessage'>
type ReactionApi = Pick<Api<RawApi>, 'setMessageReaction'>
type MediaGroupApi = Pick<Api<RawApi>, 'sendMediaGroup'>

interface MintedSnapshot {
  nftImage?: string | null
  nftUrl?: string | null
  name?: string | null
}

export interface TelegramSendersDependencies {
  admins: readonly number[]
  chats: Languages
  channels: Languages
  translate: (
    lang: string,
    key: string,
    vars?: TranslationVariables<string>,
  ) => string
  randomEmoji: () => ReactionTypeEmoji
  ipfsLink: (hash: string) => string
  findMinted: () => Promise<MintedSnapshot[]>
  findQueue: () => Promise<UserDoc[]>
  sendPlaceInLine: (
    api: SendMessageApi,
    userId: number,
    sendAnyway?: boolean,
  ) => Promise<boolean>
  errorLog: (error: unknown) => void
}

function createDefaultTelegramSendersDependencies(): TelegramSendersDependencies {
  return {
    get admins() {
      return config.BOT_ADMINS
    },
    get chats() {
      return getCubeChats()
    },
    get channels() {
      return getCubeChannels()
    },
    translate: (lang, key, vars) => i18n.t(lang, key, vars),
    randomEmoji: getRandomCoolEmoji,
    ipfsLink: linkToIPFSGateway,
    findMinted: () => findMintedWithDate() as unknown as Promise<MintedSnapshot[]>,
    findQueue,
    sendPlaceInLine: (api, userId, sendAnyway) =>
      sendPlaceInLine(api as Api<RawApi>, userId, sendAnyway),
    errorLog: (err) => logger.error(err),
  }
}

export function buildTelegramSenders(
  deps: TelegramSendersDependencies = createDefaultTelegramSendersDependencies(),
) {
  async function sendMessageToAdmins(api: SendMessageApi, message: string) {
    for (const adminId of deps.admins) {
      await api.sendMessage(adminId, message)
    }
  }

  async function sendPreviewNFT(
    api: SendPhotoApi,
    chat: string | number,
    lang: string,
    ipfsImageHash: string,
    nftUrl: string,
    nftNumber: number,
    diceWinner: boolean,
  ) {
    const collection = 'cubeworlds'
    const collectionLink = `<a href="https://getgems.io/${collection}?utm_campaign=${collection}&utm_source=inline&utm_medium=collection">Cube Worlds</a>`
    const emoji1 = diceWinner ? '🎲' : deps.randomEmoji().emoji
    const emoji2 = diceWinner ? '🎲' : deps.randomEmoji().emoji
    const caption = deps.translate(
      lang,
      `queue.${diceWinner ? `new_nft_dice` : `new_nft`}`,
      {
        emoji1,
        emoji2,
        number: nftNumber,
        collectionLink,
      },
    )
    const linkTitle = deps.translate(lang, 'queue.new_nft_button')

    return api.sendPhoto(chat, deps.ipfsLink(ipfsImageHash), {
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: linkTitle,
              url: `${nftUrl}?utm_campaign=${collection}&utm_source=inline&utm_medium=nft`,
            },
          ],
        ],
      },
    })
  }

  async function sendToGroupsNewNFT(
    api: SendPhotoApi & ReactionApi & SendMessageApi,
    ipfsImageHash: string,
    nftNumber: number,
    nftUrl: string,
    diceWinner: boolean,
  ) {
    try {
      for (const [lang, chat] of Object.entries(deps.chats)) {
        const result = await sendPreviewNFT(
          api,
          chat,
          lang,
          ipfsImageHash,
          nftUrl,
          nftNumber,
          diceWinner,
        )

        await api.setMessageReaction(result.chat.id, result.message_id, [
          deps.randomEmoji(),
        ])
      }
    } catch (error) {
      deps.errorLog(error)
      await sendMessageToAdmins(api, `Error message new NFT to chat: ${error}`)
    }
  }

  async function sendPostToChannels(api: MediaGroupApi) {
    const allMinted = await deps.findMinted()
    const imagesCount = 9
    if (allMinted.length >= imagesCount && allMinted.length % imagesCount === 0) {
      const shortList = allMinted.slice(0, imagesCount)
      const images = shortList.reverse().map((u) =>
        InputMediaBuilder.photo(deps.ipfsLink(u.nftImage ?? ''), {
          caption: `@cube_worlds_bot | <a href="${u.nftUrl ?? ''}">${u.name ?? ''}</a>`,
          parse_mode: 'HTML',
        }),
      )

      for (const [_lang, channel] of Object.entries(deps.channels)) {
        await api.sendMediaGroup(channel, images, {
          disable_notification: true,
        })
      }
    }
  }

  async function sendNewPlaces(api: SendMessageApi) {
    const users = await deps.findQueue()
    for (const user of users) {
      await deps.sendPlaceInLine(api, user.id, false)
    }
  }

  return {
    sendMessageToAdmins,
    sendPreviewNFT,
    sendToGroupsNewNFT,
    sendPostToChannels,
    sendNewPlaces,
  }
}

const defaultTelegramSenders = buildTelegramSenders()

export const sendMessageToAdmins = defaultTelegramSenders.sendMessageToAdmins
export const sendPreviewNFT = defaultTelegramSenders.sendPreviewNFT
export const sendToGroupsNewNFT = defaultTelegramSenders.sendToGroupsNewNFT
export const sendPostToChannels = defaultTelegramSenders.sendPostToChannels
export const sendNewPlaces = defaultTelegramSenders.sendNewPlaces
