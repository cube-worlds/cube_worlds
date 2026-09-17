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
  findChatMessageAuthor: (chatId: number, messageId: number) => Promise<number | null>
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
    const authorId = await deps.findChatMessageAuthor(update.chat.id, update.message_id)
    if (authorId === null) return
    // The reaction update has no author name; giveTip only needs it for the
    // one-time nudge, where a mention by id is enough.
    await deps.giveTip({
      tipperId: update.user.id,
      recipientId: authorId,
      chatId: update.chat.id,
      messageId: update.message_id,
      recipientName: `id${authorId}`,
    })
  }
}
