// Pure tip logic: allowance check, record-then-credit, best-effort chat
// feedback. The composer (index.ts) wires Telegram + Mongo deps.
import type { BalanceChangeType } from '#root/common/models/Balance'
import { BalanceChangeType as Ledger } from '#root/common/models/Balance'

export interface TipUser {
  id: number
  pass?: unknown
  rep?: { helped: number, gave: number }
  firstLoginAt?: Date
  communityNudgedAt?: Date
  language?: string
  name?: string
}

export interface TipInput {
  tipperId: number
  recipientId: number
  chatId: number
  messageId: number
  votes: bigint
}

export interface GiveTipDependencies {
  tipVotes: bigint
  basePerDay: number
  repPerExtra: number
  now: () => Date
  findUserById: (id: number) => Promise<TipUser | null>
  findOrCreateUser: (id: number) => Promise<TipUser | null>
  countTipsSince: (tipperId: number, since: Date) => Promise<number>
  recordTip: (tip: TipInput) => Promise<boolean>
  addPoints: (userId: number, votes: bigint, reason: BalanceChangeType) => Promise<bigint>
  markJoinedViaChat: (userId: number) => Promise<void>
  markCommunityNudged: (userId: number, now: Date) => Promise<void>
  react: (chatId: number, messageId: number) => Promise<void>
  reply: (chatId: number, messageId: number, text: string) => Promise<void>
  translate: (locale: string, key: string, vars: Record<string, string | number>) => string
  logError: (message: string) => void
}

export type GiveTipResult
  = | { ok: true, votes: bigint }
    | { ok: false, reason: 'self' | 'holders_only' | 'no_allowance' | 'duplicate' | 'credit_failed' }

export function utcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function tipsPerDay(
  rep: { helped: number, gave: number } | undefined,
  base: number,
  repPerExtra: number,
): number {
  const score = (rep?.helped ?? 0) + (rep?.gave ?? 0)
  return base + Math.floor(score / repPerExtra)
}

export function buildGiveTip(deps: GiveTipDependencies) {
  return async function giveTip(input: {
    tipperId: number
    recipientId: number
    chatId: number
    messageId: number
    recipientName: string
    recipientLanguage?: string
  }): Promise<GiveTipResult> {
    const { tipperId, recipientId, chatId, messageId } = input
    if (tipperId === recipientId) return { ok: false, reason: 'self' }

    const tipper = await deps.findUserById(tipperId)
    if (!tipper?.pass) return { ok: false, reason: 'holders_only' }

    const now = deps.now()
    // ponytail: count-then-insert without a lock; two simultaneous reactions
    // can overshoot the allowance by one. Single process today.
    const used = await deps.countTipsSince(tipperId, utcMidnight(now))
    if (used >= tipsPerDay(tipper.rep, deps.basePerDay, deps.repPerExtra)) {
      return { ok: false, reason: 'no_allowance' }
    }

    // Record FIRST: a redelivered update loses on the unique index and never
    // double-credits.
    const fresh = await deps.recordTip({ tipperId, recipientId, chatId, messageId, votes: deps.tipVotes })
    if (!fresh) return { ok: false, reason: 'duplicate' }

    const recipient = await deps.findOrCreateUser(recipientId)
    const unregistered = !recipient?.firstLoginAt
    if (unregistered) await deps.markJoinedViaChat(recipientId)

    try {
      await deps.addPoints(recipientId, deps.tipVotes, Ledger.Tip)
    } catch (err) {
      deps.logError(`!!! Tip credit failed for ${recipientId} on ${chatId}/${messageId}: ${(err as Error).message}`)
      return { ok: false, reason: 'credit_failed' }
    }

    try {
      await deps.react(chatId, messageId)
    } catch (err) {
      deps.logError(`Tip react failed on ${chatId}/${messageId}: ${(err as Error).message}`)
    }

    if (unregistered && !recipient?.communityNudgedAt) {
      const locale = input.recipientLanguage === 'ru' || recipient?.language === 'ru' ? 'ru' : 'en'
      try {
        await deps.reply(chatId, messageId, deps.translate(locale, 'community_nudge', {
          name: input.recipientName,
          votes: deps.tipVotes.toString(),
        }))
        await deps.markCommunityNudged(recipientId, now)
      } catch (err) {
        deps.logError(`Tip nudge failed for ${recipientId}: ${(err as Error).message}`)
      }
    }

    return { ok: true, votes: deps.tipVotes }
  }
}
