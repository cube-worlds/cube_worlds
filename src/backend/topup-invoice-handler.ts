import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
  stars: number
}

// Telegram caps a single Stars invoice at 2500 XTR.
export const MIN_TOPUP_STARS = 1
export const MAX_TOPUP_STARS = 2500

// Round-trips through Telegram verbatim (users cannot tamper with it), so the
// quoted votes amount is honored at payment time even if the rate changes.
export function buildTopupPayload(
  userId: number,
  stars: number,
  votes: bigint,
): string {
  return `cube-topup:${userId}:${stars}:${votes}`
}

export interface TopupInvoiceHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  votesPerStar: () => bigint
  createInvoiceLink: (args: {
    title: string
    description: string
    payload: string
    stars: number
  }) => Promise<string>
  logError: (message: string) => void
}

const topupBodySchema = {
  body: {
    type: 'object',
    properties: {
      initData: { type: 'string', maxLength: 8192 },
      stars: {
        type: 'integer',
        minimum: MIN_TOPUP_STARS,
        maximum: MAX_TOPUP_STARS,
      },
    },
    required: ['stars'],
  },
} as const

export function buildTopupInvoiceHandler(
  dependencies: TopupInvoiceHandlerDependencies,
) {
  return async function topupInvoiceHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/topup/invoice',
      { schema: topupBodySchema, attachValidation: true },
      async (request) => {
        try {
          if (request.validationError) return { error: 'Invalid request body' }
          const { initData, stars } = request.body
          if (!initData) return { error: 'No initData or hash provided' }
          dependencies.validateInitData(initData)
          const parsed = dependencies.parseInitData(initData)
          const userId = parsed?.user?.id
          if (!userId) return { error: 'Invalid telegram user id' }

          const votes = dependencies.votesPerStar() * BigInt(stars)
          const link = await dependencies.createInvoiceLink({
            title: `${votes} $CUBE`,
            description: `Top up ${votes} $CUBE for ${stars} Stars`,
            payload: buildTopupPayload(userId, stars, votes),
            stars,
          })

          return { link, votes: votes.toString(), stars }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}
