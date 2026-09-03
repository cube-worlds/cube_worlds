import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { Pass } from './login-payload'
import { clearUserPass, findOrCreateUser, findUserById, setUserPass } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { loginPayload } from './login-payload'
import { verifyPassOwnership } from './pass'
import { safeErrorResponse } from './safe-error'

interface Body {
  initData: string
  referId?: string
}

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

// Re-check on-chain ownership at most once an hour per login.
export const PASS_REVALIDATE_MS = 60 * 60 * 1000

export interface AuthHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  // Upsert on login so a brand-new user exists and can begin minting.
  findOrCreateUser: (id: number) => Promise<ExistingUser | null>
  info: (message: string) => void
  error: (message: string) => void
  logError: (message: string) => void
  verifyPassOwnership: (passAddress: string, ownerAddress: string) => Promise<boolean>
  setUserPass: (userId: number, pass: Pass, verifiedAt: Date) => Promise<void>
  clearUserPass: (userId: number) => Promise<void>
}

function createDefaultDependencies(): AuthHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findOrCreateUser,
    info: logger.info.bind(logger),
    error: logger.error.bind(logger),
    logError: logger.error.bind(logger),
    verifyPassOwnership,
    setUserPass,
    clearUserPass,
  }
}

export function buildAuthHandler(
  dependencies: AuthHandlerDependencies = createDefaultDependencies(),
) {
  return async function authHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/login',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              initData: { type: 'string', maxLength: 8192 },
              referId: { type: 'string', maxLength: 64 },
            },
          },
        },
        // Keep legacy { error } envelope: missing initData stays a
        // handler-level check; only ill-typed/oversized bodies hit AJV.
        attachValidation: true,
      },
      async (request) => {
        if (request.validationError) {
          return { error: 'Invalid request body' }
        }
        const { initData, referId } = request.body
        if (!initData) return { error: 'No initData or hash provided' }

        try {
          dependencies.validateInitData(initData)
          const parsedData = dependencies.parseInitData(initData)

          const tgUserId = parsedData?.user?.id
          if (!tgUserId) {
            return { error: 'Invalid telegram user id' }
          }
          // Upsert: a first-time login creates the user so they can mint.
          const user = await dependencies.findOrCreateUser(tgUserId)
          if (!user) return { error: 'User not found' }

          // Sync the display name from Telegram — nothing else sets it for
          // webview-only users, and admin captions + data folders rely on it.
          const tgName
            = parsedData.user?.username ?? parsedData.user?.first_name
          if (tgName && user.name !== tgName) {
            user.name = tgName
            await user.save()
          }

          const userAlreadyInvited = user.wallet || user.referalId
          if (referId && !userAlreadyInvited) {
            const receiverId = Number(referId)
            const receiver = await dependencies.findUserById(receiverId)
            if (receiver && receiverId !== user.id) {
              user.referalId = receiverId
              await user.save()
              dependencies.info('Referrer added successfully')
            } else {
              dependencies.error('Referrer not found or same as user')
            }
          }

          // Hourly ownership revalidation. Provider failure keeps the pass —
          // never lock a holder out on a toncenter outage.
          const pass = user.pass
          if (pass && Date.now() - pass.verifiedAt.getTime() > PASS_REVALIDATE_MS) {
            try {
              const owned = user.wallet
                ? await dependencies.verifyPassOwnership(pass.address, user.wallet)
                : false
              if (owned) {
                // Persist the refresh; the in-memory `pass` is discarded
                // right after this request (loginPayload doesn't echo
                // verifiedAt), so it doesn't need updating here — and
                // mutating the caller's object in place is best avoided.
                await dependencies.setUserPass(user.id, pass, new Date())
              } else {
                await dependencies.clearUserPass(user.id)
                user.pass = undefined
              }
            } catch (err) {
              dependencies.error(`Pass revalidation skipped for ${user.id}: ${(err as Error).message}`)
            }
          }

          return {
            ...loginPayload(user, parsedData.user?.username ?? null),
            ip: request.ip,
          }
        } catch (err) {
          return safeErrorResponse(err, dependencies.logError)
        }
      },
    )
  }
}

const authHandler = buildAuthHandler()

export default authHandler
