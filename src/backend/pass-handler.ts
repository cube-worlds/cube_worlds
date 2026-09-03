import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { LoginUser, Pass } from './login-payload'
import { Address } from '@ton/core'
import { loginPayload } from './login-payload'
import { safeErrorResponse } from './safe-error'

export const MAX_PASSES = 20
const PUBLIC_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

export interface PassHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUser: (id: number) => Promise<LoginUser | null>
  // Every Cube Worlds NFT held by the wallet (already filtered by collection).
  listPasses: (ownerAddress: string) => Promise<Pass[]>
  setUserPass: (userId: number, pass: Pass, verifiedAt: Date) => Promise<void>
  logError: (message: string) => void
}

// Subset of toncenter v3 GET /api/v3/nft/items we read.
export interface NftItemsResponse {
  nft_items: Array<{ address: string, index: string, owner_address?: string }>
  metadata?: Record<string, { token_info?: Array<{ name?: string, image?: string }> }>
}

function publicImageUrl(uri: string | undefined): string {
  if (!uri) return ''
  return uri.startsWith('ipfs://')
    ? `${PUBLIC_IPFS_GATEWAY}${uri.slice('ipfs://'.length)}`
    : uri
}

// ponytail: trusts toncenter's indexed metadata; if a fresh mint shows up as
// "Pass #N" with no image, add a fallback fetch of the item content JSON here.
export function parseNftItems(body: NftItemsResponse): Pass[] {
  return body.nft_items.map((item) => {
    const info = body.metadata?.[item.address]?.token_info?.[0]
    const index = Number(item.index)
    return {
      index,
      address: Address.parse(item.address).toString({ bounceable: true }),
      name: info?.name ?? `Pass #${index}`,
      image: publicImageUrl(info?.image),
    }
  })
}

interface ScanBody {
  initData: string
}

interface SelectBody extends ScanBody {
  index: number
}

export function buildPassHandler(dependencies: PassHandlerDependencies) {
  async function authedUser(initData: string | undefined) {
    if (!initData) return { error: { error: 'No initData provided' } }
    dependencies.validateInitData(initData)
    const parsed = dependencies.parseInitData(initData)
    const tgUserId = parsed?.user?.id
    if (!tgUserId) return { error: { error: 'Invalid telegram user id' } }
    const user = await dependencies.findUser(tgUserId)
    if (!user) return { error: { error: 'User not found' } }
    return { user, username: parsed.user?.username ?? null }
  }

  return async function passHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: ScanBody }>(
      '/scan',
      {
        schema: {
          body: {
            type: 'object',
            properties: { initData: { type: 'string', maxLength: 8192 } },
          },
        },
        attachValidation: true,
      },
      async (request, reply) => {
        if (request.validationError) return { error: 'Invalid request body' }
        try {
          const auth = await authedUser(request.body?.initData)
          if ('error' in auth) return auth.error
          if (!auth.user.wallet) {
            return reply.code(400).send({ error: 'Bind a TON wallet first', code: 'wallet_required' })
          }
          try {
            const passes = await dependencies.listPasses(auth.user.wallet)
            return { passes: passes.slice(0, MAX_PASSES) }
          } catch (err) {
            dependencies.logError(`Pass scan failed for ${auth.user.id}: ${(err as Error).message}`)
            return reply.code(502).send({ error: 'Could not read the wallet, try again', code: 'scan_failed' })
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )

    fastify.post<{ Body: SelectBody }>(
      '/select',
      {
        schema: {
          body: {
            type: 'object',
            required: ['index'],
            properties: {
              initData: { type: 'string', maxLength: 8192 },
              index: { type: 'integer', minimum: 0 },
            },
          },
        },
        attachValidation: true,
      },
      async (request, reply) => {
        if (request.validationError) {
          return reply.code(400).send({ error: 'Invalid request body' })
        }
        try {
          const auth = await authedUser(request.body?.initData)
          if ('error' in auth) return auth.error
          const { user, username } = auth
          if (!user.wallet) {
            return reply.code(400).send({ error: 'Bind a TON wallet first', code: 'wallet_required' })
          }
          let passes: Pass[]
          try {
            passes = await dependencies.listPasses(user.wallet)
          } catch (err) {
            dependencies.logError(`Pass scan failed for ${user.id}: ${(err as Error).message}`)
            return reply.code(502).send({ error: 'Could not read the wallet, try again', code: 'scan_failed' })
          }
          const found = passes.find((p) => p.index === request.body.index)
          if (!found) {
            return reply.code(403).send({ error: 'This pass is not in your wallet', code: 'not_owned' })
          }
          const verifiedAt = new Date()
          await dependencies.setUserPass(user.id, found, verifiedAt)
          return loginPayload(
            {
              id: user.id,
              language: user.language,
              wallet: user.wallet,
              referalId: user.referalId,
              votes: user.votes,
              minted: user.minted,
              state: user.state,
              pass: { ...found, verifiedAt },
            },
            username,
          )
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}
