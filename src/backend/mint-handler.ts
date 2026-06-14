import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { MintFloorParams } from '#root/common/helpers/mint-floor'
import { mintFloorVotes } from '#root/common/helpers/mint-floor'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
}

// A read snapshot of the fields the mint flow needs. Decoupled from the
// Mongoose doc so the pure handler stays test-friendly (no DB, no config).
export interface MintUser {
  id: number
  votes: bigint
  state: string
  minted: boolean
  nftUrl?: string
  image?: string
  description?: string
  avatar?: string
  name?: string
}

export interface MintHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findMintUser: (id: number) => Promise<MintUser | null>
  // Total NFTs minted — drives the escalating floor.
  countMinted: () => Promise<number>
  // Rank among eligible submissions (count with votes ≥ this user's votes).
  queuePosition: (votes: bigint) => Promise<number | undefined>
  floorParams: () => MintFloorParams
  // Semi-auto generation seams (heavy; injected by the composer).
  generateImage: (user: MintUser) => Promise<string>
  generateDescription: (user: MintUser) => Promise<string>
  // Persist the generated draft and move the user into the review queue.
  persistDraft: (
    userId: number,
    image: string,
    description: string,
  ) => Promise<void>
  logError: (message: string) => void
}

// schema shared by every /api/mint route — all take a signed initData string.
const initDataBodySchema = {
  body: {
    type: 'object',
    properties: {
      initData: { type: 'string', maxLength: 8192 },
    },
  },
} as const

export function buildMintHandler(dependencies: MintHandlerDependencies) {
  // Resolve the Telegram user from initData; returns the userId or an error
  // envelope (mirrors the legacy { error } contract used elsewhere).
  function resolveUserId(
    request: { validationError?: unknown, body: Body },
  ): { userId: number } | { error: string } {
    if (request.validationError) return { error: 'Invalid request body' }
    const { initData } = request.body
    if (!initData) return { error: 'No initData or hash provided' }
    dependencies.validateInitData(initData)
    const parsed = dependencies.parseInitData(initData)
    const tgUserId = parsed?.user?.id
    if (!tgUserId) return { error: 'Invalid telegram user id' }
    return { userId: tgUserId }
  }

  return async function mintHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/quote',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const resolved = resolveUserId(request)
          if ('error' in resolved) return resolved

          const user = await dependencies.findMintUser(resolved.userId)
          if (!user) return { error: 'User not found' }

          const mintedCount = await dependencies.countMinted()
          const floorVotes = mintFloorVotes(
            mintedCount,
            dependencies.floorParams(),
          )
          const eligible = user.votes >= floorVotes
          const queuePosition = eligible
            ? await dependencies.queuePosition(user.votes)
            : undefined

          return {
            floorVotes: floorVotes.toString(),
            yourVotes: user.votes.toString(),
            mintedCount,
            eligible,
            queuePosition,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    fastify.post<{ Body: Body }>(
      '/generate',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const resolved = resolveUserId(request)
          if ('error' in resolved) return resolved

          const user = await dependencies.findMintUser(resolved.userId)
          if (!user) return { error: 'User not found' }
          if (user.minted) return { error: 'Already minted' }
          if (!user.avatar) return { error: 'Connect a wallet and set an avatar first' }

          const image = await dependencies.generateImage(user)
          const description = await dependencies.generateDescription(user)
          // Persist the draft and queue the user for review (clears Rework).
          await dependencies.persistDraft(resolved.userId, image, description)

          return { image, description }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    fastify.post<{ Body: Body }>(
      '/status',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const resolved = resolveUserId(request)
          if ('error' in resolved) return resolved

          const user = await dependencies.findMintUser(resolved.userId)
          if (!user) return { error: 'User not found' }

          const mintedCount = await dependencies.countMinted()
          const floorVotes = mintFloorVotes(
            mintedCount,
            dependencies.floorParams(),
          )
          const eligible = user.votes >= floorVotes

          return {
            state: user.state,
            minted: user.minted,
            nftUrl: user.nftUrl,
            // Re-generation is allowed until minted — covers a fresh user and
            // an admin-returned (Rework) draft alike.
            canGenerate: !user.minted,
            floorVotes: floorVotes.toString(),
            yourVotes: user.votes.toString(),
            eligible,
            image: user.image,
            description: user.description,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}
