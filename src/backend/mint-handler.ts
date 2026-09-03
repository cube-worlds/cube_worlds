import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import { UserState } from '#root/common/models/User'
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
  wallet?: string
  name?: string
}

export interface MintHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findMintUser: (id: number) => Promise<MintUser | null>
  // Price of one generation try, in votes ($CUBE).
  tryCost: () => bigint
  // Overdraft-safe debit of one try. Returns the new balance, or null when the
  // balance doesn't cover the cost (CAS lost / insufficient funds).
  debitTry: (userId: number) => Promise<bigint | null>
  // Refund a try whose generation failed after the debit landed.
  refundTry: (userId: number) => Promise<void>
  // Semi-auto generation seams (heavy; injected by the composer).
  generateImage: (user: MintUser) => Promise<string>
  generateDescription: (user: MintUser) => Promise<string>
  // Persist the generated draft. Does NOT submit — the user decides that.
  persistDraft: (
    userId: number,
    image: string,
    description: string,
  ) => Promise<void>
  // The user liked the draft: move it into admin review (Submited).
  submitDraft: (userId: number) => Promise<void>
  // Push the submitted draft to every admin with Approve/Decline buttons.
  notifyAdmins: (user: MintUser) => Promise<void>
  // Local image path → data URL for the webview (null if unreadable).
  readImageDataUrl: (path: string) => Promise<string | null>
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

  async function loadUser(
    request: { validationError?: unknown, body: Body },
  ): Promise<{ user: MintUser } | { error: string }> {
    const resolved = resolveUserId(request)
    if ('error' in resolved) return resolved
    const user = await dependencies.findMintUser(resolved.userId)
    if (!user) return { error: 'User not found' }
    return { user }
  }

  return async function mintHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/quote',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const loaded = await loadUser(request)
          if ('error' in loaded) return loaded
          const { user } = loaded
          const tryCost = dependencies.tryCost()

          return {
            tryCost: tryCost.toString(),
            yourVotes: user.votes.toString(),
            canAfford: user.votes >= tryCost,
            state: user.state,
            minted: user.minted,
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
          const loaded = await loadUser(request)
          if ('error' in loaded) return loaded
          const { user } = loaded

          if (user.minted) return { error: 'Already minted' }
          if (user.state === UserState.Submited) {
            return { error: 'Draft is under review' }
          }
          if (!user.avatar) return { error: 'Select an avatar first' }

          // Paid try: debit BEFORE the expensive generation. The CAS makes an
          // overdraft impossible under concurrent taps.
          const balanceAfterDebit = await dependencies.debitTry(user.id)
          if (balanceAfterDebit === null) {
            return {
              error: 'Not enough $CUBE',
              tryCost: dependencies.tryCost().toString(),
              yourVotes: user.votes.toString(),
            }
          }

          let image: string
          let description: string
          try {
            image = await dependencies.generateImage(user)
            description = await dependencies.generateDescription(user)
          } catch (err) {
            // Generation failed after the debit landed — give the try back.
            dependencies.logError(
              `Generation failed for ${user.id}: ${(err as Error).message}`,
            )
            await dependencies.refundTry(user.id)
            return { error: 'Generation failed — your try was refunded' }
          }

          await dependencies.persistDraft(user.id, image, description)
          const imageDataUrl = await dependencies.readImageDataUrl(image)

          return {
            image: imageDataUrl,
            description,
            yourVotes: balanceAfterDebit.toString(),
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    fastify.post<{ Body: Body }>(
      '/submit',
      { schema: initDataBodySchema, attachValidation: true },
      async (request) => {
        try {
          const loaded = await loadUser(request)
          if ('error' in loaded) return loaded
          const { user } = loaded

          if (user.minted) return { error: 'Already minted' }
          if (user.state === UserState.Submited) {
            return { error: 'Already submitted' }
          }
          if (!user.image || !user.description) {
            return { error: 'Generate an image first' }
          }
          if (!user.wallet) return { error: 'Connect a wallet first' }

          await dependencies.submitDraft(user.id)
          // Never fail the submit on a notification hiccup — admins can still
          // reach the draft through /queue.
          try {
            await dependencies.notifyAdmins(user)
          } catch (err) {
            dependencies.logError(
              `Admin notify failed for ${user.id}: ${(err as Error).message}`,
            )
          }

          return { ok: true, state: UserState.Submited }
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
          const loaded = await loadUser(request)
          if ('error' in loaded) return loaded
          const { user } = loaded
          const tryCost = dependencies.tryCost()

          const avatarDataUrl = user.avatar
            ? await dependencies.readImageDataUrl(user.avatar)
            : null
          const imageDataUrl = user.image
            ? await dependencies.readImageDataUrl(user.image)
            : null

          return {
            state: user.state,
            minted: user.minted,
            nftUrl: user.nftUrl,
            tryCost: tryCost.toString(),
            yourVotes: user.votes.toString(),
            canAfford: user.votes >= tryCost,
            hasWallet: Boolean(user.wallet),
            avatar: avatarDataUrl,
            image: imageDataUrl,
            description: user.description,
            canGenerate:
              !user.minted && user.state !== UserState.Submited,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}
