import type { GiveTipFn } from './reaction-tip-handler'

export interface TipCommandMessage {
  chat: { id: number }
  from?: { id: number }
  reply_to_message?: {
    message_id: number
    from?: { id: number, is_bot: boolean, first_name: string, username?: string, language_code?: string }
    sender_chat?: unknown
  }
}

export interface CommandTipDependencies {
  giveTip: GiveTipFn
  reply: (chatId: number, replyTo: number, text: string) => Promise<void>
  translate: (locale: string, key: string) => string
  logError: (message: string) => void
}

const REASON_KEY: Record<string, string> = {
  self: 'tip_invalid_target',
  holders_only: 'tip_holders_only',
  no_allowance: 'tip_no_allowance',
  credit_failed: 'tip_failed',
}

export function buildCommandTipHandler(deps: CommandTipDependencies) {
  return async function handleTipCommand(message: TipCommandMessage, locale: string): Promise<void> {
    const tipper = message.from
    if (!tipper) return
    const target = message.reply_to_message
    const author = target?.from
    const replyTo = target?.message_id ?? 0
    const say = async (key: string) => {
      try {
        await deps.reply(message.chat.id, replyTo, deps.translate(locale, key))
      } catch (err) {
        deps.logError(`/tip reply failed: ${(err as Error).message}`)
      }
    }
    if (!target || !author || author.is_bot || target.sender_chat) {
      await say('tip_invalid_target')
      return
    }
    const result = await deps.giveTip({
      tipperId: tipper.id,
      recipientId: author.id,
      chatId: message.chat.id,
      messageId: target.message_id,
      recipientName: author.username ?? author.first_name,
      recipientLanguage: author.language_code,
    })
    if (result.ok || result.reason === 'duplicate') return
    await say(REASON_KEY[result.reason])
  }
}
