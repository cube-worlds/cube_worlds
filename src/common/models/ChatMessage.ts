import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose'

// chat+message -> author, so a reaction (which carries no author) can be
// turned into a tip. Rows expire after 7 days; a reaction on an older message
// is silently ignored.
const TTL_SECONDS = 7 * 24 * 60 * 60

@modelOptions({
  schemaOptions: { timestamps: { createdAt: true, updatedAt: false } },
})
@index({ chatId: 1, messageId: 1 }, { unique: true })
@index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS })
class ChatMessage {
  @prop({ type: Number, required: true })
  chatId!: number

  @prop({ type: Number, required: true })
  messageId!: number

  @prop({ type: Number, required: true })
  authorId!: number

  // username if the author has one, else first_name — captured at index time
  // so a reaction (no `from` on the update) can still produce a real mention
  // instead of a synthesized "id<number>" fallback. Absent on rows indexed
  // before this field existed; those age out within the 7-day TTL above.
  @prop({ type: String })
  authorName?: string

  @prop({ type: Date })
  createdAt?: Date
}

const ChatMessageModel = getModelForClass(ChatMessage)

export interface ChatMessageAuthor {
  id: number
  name?: string
}

export async function indexChatMessage(chatId: number, messageId: number, authorId: number, authorName?: string): Promise<void> {
  await ChatMessageModel.updateOne(
    { chatId, messageId },
    { $setOnInsert: { chatId, messageId, authorId, authorName, createdAt: new Date() } },
    { upsert: true },
  )
}

export async function findChatMessageAuthor(chatId: number, messageId: number): Promise<ChatMessageAuthor | null> {
  const row = await ChatMessageModel.findOne({ chatId, messageId }, { authorId: 1, authorName: 1 }).lean()
  return row ? { id: row.authorId, name: row.authorName } : null
}
