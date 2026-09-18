import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { tipsPerDay, utcMidnight } from '#root/bot/features/community/give-tip'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string }

export interface CommunityUser {
  id: number
  pass?: unknown
  rep?: { helped: number, gave: number }
  inviteLinks?: Record<string, string>
}

export interface CommunityApiDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUser: (id: number) => Promise<CommunityUser | null>
  chatIds: number[]
  tipVotes: bigint
  basePerDay: number
  repPerExtra: number
  now: () => Date
  countTipsSince: (tipperId: number, since: Date) => Promise<number>
  chatTitle: (chatId: number) => Promise<string>
  // Link name = the user's id; join-handler reads it back as the inviter.
  createInviteLink: (chatId: number, name: string) => Promise<string>
  saveInviteLink: (userId: number, chatId: number, url: string) => Promise<void>
  countInvitedLoggedIn: (userId: number) => Promise<number>
  logError: (message: string) => void
}

export function buildCommunityApiHandler(deps: CommunityApiDependencies) {
  return async function communityApiHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/community',
      { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true },
      async (request) => {
        try {
          if (request.validationError) return { error: 'Invalid request body' }
          const { initData } = request.body
          if (!initData) return { error: 'No initData or hash provided' }
          deps.validateInitData(initData)
          const userId = deps.parseInitData(initData)?.user?.id
          if (!userId) return { error: 'Invalid telegram user id' }
          const user = await deps.findUser(userId)
          if (!user) return { error: 'User not found' }

          let tips: { perDay: number, left: number, votes: string } | null = null
          if (user.pass) {
            const perDay = tipsPerDay(user.rep, deps.basePerDay, deps.repPerExtra)
            const used = await deps.countTipsSince(userId, utcMidnight(deps.now()))
            tips = { perDay, left: Math.max(0, perDay - used), votes: deps.tipVotes.toString() }
          }

          const invites: Array<{ chatId: string, title: string, url: string }> = []
          for (const chatId of deps.chatIds) {
            try {
              let url = user.inviteLinks?.[String(chatId)]
              if (!url) {
                url = await deps.createInviteLink(chatId, String(userId))
                await deps.saveInviteLink(userId, chatId, url)
              }
              invites.push({ chatId: String(chatId), title: await deps.chatTitle(chatId), url })
            } catch (err) {
              deps.logError(`Community invite link for chat ${chatId} failed: ${(err as Error).message}`)
            }
          }

          return { tips, invites, invitedLoggedIn: await deps.countInvitedLoggedIn(userId) }
        } catch (err) {
          return safeErrorResponse(err, deps.logError)
        }
      },
    )
  }
}
