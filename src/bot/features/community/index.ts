import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { logHandle } from '#root/common/helpers/logging'
import { i18n } from '#root/common/i18n'
import { findChatMessageAuthor, indexChatMessage } from '#root/common/models/ChatMessage'
import { countTipsSince, recordTip } from '#root/common/models/Tip'
import {
  addPoints,
  findOrCreateUser,
  findUserById,
  markCommunityNudged,
  markJoinedViaChat,
  setChatReferral,
} from '#root/common/models/User'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { buildCommandTipHandler } from './command-tip-handler'
import { buildGiveTip } from './give-tip'
import { buildIndexerHandler } from './indexer-handler'
import { buildJoinHandler } from './join-handler'
import { buildReactionTipHandler } from './reaction-tip-handler'

// Community chats (EN/RU): holder tips + invite-link attribution. Mounted
// BEFORE attachUser and never calls next() for allow-listed chats, so group
// traffic does not upsert a User per message.
const composer = new Composer<Context>()

const chatIds = new Set(config.COMMUNITY_CHAT_IDS)
const community = composer.filter(ctx => ctx.chat !== undefined && chatIds.has(ctx.chat.id))

// The composer has no api handle of its own; the handlers below stash the
// current ctx.api before calling giveTip. Single-threaded per update.
let currentApi: Context['api'] | null = null
function composerApi(): Context['api'] {
  if (!currentApi) throw new Error('community: api not bound')
  return currentApi
}

const giveTip = buildGiveTip({
  tipVotes: BigInt(config.TIP_VOTES),
  basePerDay: config.TIP_BASE_PER_DAY,
  repPerExtra: config.TIP_REP_PER_EXTRA,
  now: () => new Date(),
  findUserById,
  findOrCreateUser,
  countTipsSince,
  recordTip,
  addPoints,
  markJoinedViaChat,
  markCommunityNudged,
  react: (chatId, messageId) => composerApi().setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: '🔥' }]).then(() => {}),
  reply: (chatId, messageId, text) => composerApi().sendMessage(chatId, text, { reply_parameters: { message_id: messageId } }).then(() => {}),
  translate: (locale, key, vars) => i18n.t(locale, key, vars),
  logError: message => logger.error(message),
})

const indexMessage = buildIndexerHandler({ indexChatMessage })
const handleReaction = buildReactionTipHandler({ tipEmoji: config.TIP_EMOJI, findChatMessageAuthor, giveTip })
const handleTipCommand = buildCommandTipHandler({
  giveTip,
  reply: (chatId, replyTo, text) => composerApi().sendMessage(chatId, text, replyTo ? { reply_parameters: { message_id: replyTo } } : {}).then(() => {}),
  translate: (locale, key) => i18n.t(locale, key),
  logError: message => logger.error(message),
})
const handleJoin = buildJoinHandler({ findOrCreateUser, setChatReferral, logInfo: message => logger.info(message) })

community.command('tip', logHandle('community-tip-command'), async (ctx) => {
  // /tip can only be a normal message in these (super)group chats, never a
  // channel post, but community's own filter doesn't narrow that at the type
  // level — guard so ctx.message is non-optional for handleTipCommand.
  if (!ctx.message) return
  currentApi = ctx.api
  const locale = ctx.from?.language_code === 'ru' ? 'ru' : 'en'
  await handleTipCommand(ctx.message, locale)
})

community.on('message', logHandle('community-index'), async (ctx) => {
  await indexMessage(ctx.message)
})

community.on('message_reaction', logHandle('community-reaction'), async (ctx) => {
  currentApi = ctx.api
  await handleReaction(ctx.messageReaction)
})

community.on('chat_member', logHandle('community-join'), async (ctx) => {
  await handleJoin(ctx.chatMember)
})

// Anything else in a community chat (edits, service messages, my_chat_member)
// is swallowed here so it never reaches attachUser.
community.use(() => {})

export { composer as communityFeature }
