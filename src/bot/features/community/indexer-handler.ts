// Records chat+message -> author so a later reaction can be attributed.
export interface IndexerMessage {
  chat: { id: number }
  message_id: number
  from?: { id: number, is_bot: boolean }
  sender_chat?: unknown
}

export interface IndexerDependencies {
  indexChatMessage: (chatId: number, messageId: number, authorId: number) => Promise<void>
}

export function buildIndexerHandler(deps: IndexerDependencies) {
  return async function indexMessage(message: IndexerMessage): Promise<void> {
    const from = message.from
    if (!from || from.is_bot || message.sender_chat) return
    await deps.indexChatMessage(message.chat.id, message.message_id, from.id)
  }
}
