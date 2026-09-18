import type { Api } from 'grammy'
import { buildCommunityApiHandler } from '#root/backend/community-api-handler'
import { countTipsSince } from '#root/common/models/Tip'
import { countInvitedLoggedIn, findUserById, setInviteLink } from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'

export function createCommunityApiHandler(api: Api) {
  // Chat titles never change in practice; one getChat per chat per process.
  const titles = new Map<number, string>()
  return buildCommunityApiHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    chatIds: [...config.COMMUNITY_CHAT_IDS],
    tipVotes: BigInt(config.TIP_VOTES),
    basePerDay: config.TIP_BASE_PER_DAY,
    repPerExtra: config.TIP_REP_PER_EXTRA,
    now: () => new Date(),
    countTipsSince,
    chatTitle: async (chatId) => {
      const cached = titles.get(chatId)
      if (cached) return cached
      const chat = await api.getChat(chatId)
      const title = ('title' in chat && chat.title) || String(chatId)
      titles.set(chatId, title)
      return title
    },
    createInviteLink: async (chatId, name) => (await api.createChatInviteLink(chatId, { name })).invite_link,
    saveInviteLink: setInviteLink,
    countInvitedLoggedIn,
    logError: message => logger.error(message),
  })
}
