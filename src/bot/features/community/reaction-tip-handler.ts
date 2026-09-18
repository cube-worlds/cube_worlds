import type { ChatMessageAuthor } from '#root/common/models/ChatMessage'
import type { buildGiveTip } from './give-tip'

export type GiveTipFn = ReturnType<typeof buildGiveTip>

export interface ReactionUpdate {
  chat: { id: number }
  message_id: number
  user?: { id: number }
  old_reaction: Array<{ type: string, emoji?: string }>
  new_reaction: Array<{ type: string, emoji?: string }>
}

export interface ReactionTipDependencies {
  tipEmoji: string
  findChatMessageAuthor: (chatId: number, messageId: number) => Promise<ChatMessageAuthor | null>
  giveTip: GiveTipFn
}

function has(list: ReactionUpdate['new_reaction'], emoji: string): boolean {
  return list.some(r => r.type === 'emoji' && r.emoji === emoji)
}

export function buildReactionTipHandler(deps: ReactionTipDependencies) {
  return async function handleReaction(update: ReactionUpdate): Promise<void> {
    // Anonymous reactions carry actor_chat instead of user — nothing to attribute.
    if (!update.user) return
    if (!has(update.new_reaction, deps.tipEmoji) || has(update.old_reaction, deps.tipEmoji)) return
    const author = await deps.findChatMessageAuthor(update.chat.id, update.message_id)
    if (author === null) return
    // The reaction update itself carries no author name — pull the one the
    // indexer captured (username, else first_name). Rows indexed before that
    // field existed (pre-deploy, aging out within the 7-day TTL) have none;
    // ponytail: fall back to the bare id rather than the old "id<number>"
    // string so the nudge is at least not a literal broken-looking mention.
    await deps.giveTip({
      tipperId: update.user.id,
      recipientId: author.id,
      chatId: update.chat.id,
      messageId: update.message_id,
      recipientName: author.name ?? String(author.id),
    })
  }
}
