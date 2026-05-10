import type { FastifyInstance } from 'fastify'
import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { i18n } from '#root/common/i18n'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'

const MIN_DWELL_MS = 20_000
const MAX_AGE_MS = 10 * 60 * 1000

interface IssuedToken {
  token: string
  nonce: string
  issuedAt: Date
}

/**
 * Generate a one-time captcha token bound to a freshly minted nonce and
 * issuance timestamp. Caller must persist `nonce` and `issuedAt` on the user
 * so verifyCaptchaToken can match them later.
 */
export function generateCaptchaToken(
  userId: number,
  expectedKills: number,
): IssuedToken {
  const secret = process.env.BOT_TOKEN ?? ''
  const nonce = randomBytes(16).toString('hex')
  const issuedAtMs = Date.now()
  const payload = `captcha:${userId}:${expectedKills}:${nonce}:${issuedAtMs}`
  const hmac = createHmac('sha256', secret).update(payload).digest('hex')
  return {
    token: `${expectedKills}:${nonce}:${issuedAtMs}:${hmac}`,
    nonce,
    issuedAt: new Date(issuedAtMs),
  }
}

interface VerifiedToken {
  ok: boolean
  reason?: string
}

export function verifyCaptchaToken(
  userId: number,
  token: string,
  expectedKills: number,
  storedNonce: string | undefined,
  storedIssuedAt: Date | undefined,
  now: number = Date.now(),
): VerifiedToken {
  const secret = process.env.BOT_TOKEN ?? ''
  if (!secret) return { ok: false, reason: 'no_secret' }
  if (!storedNonce || !storedIssuedAt) return { ok: false, reason: 'no_pending_captcha' }

  const parts = token.split(':')
  if (parts.length !== 4) return { ok: false, reason: 'bad_format' }

  const [killsStr, nonce, issuedAtStr, providedHmac] = parts
  if (Number(killsStr) !== expectedKills) return { ok: false, reason: 'kills_mismatch' }
  if (nonce !== storedNonce) return { ok: false, reason: 'nonce_mismatch' }

  const issuedAt = Number(issuedAtStr)
  if (!Number.isInteger(issuedAt)) return { ok: false, reason: 'bad_timestamp' }
  if (issuedAt !== storedIssuedAt.getTime()) return { ok: false, reason: 'timestamp_mismatch' }

  const age = now - issuedAt
  if (age < MIN_DWELL_MS) return { ok: false, reason: 'too_fast' }
  if (age > MAX_AGE_MS) return { ok: false, reason: 'expired' }

  const payload = `captcha:${userId}:${expectedKills}:${nonce}:${issuedAt}`
  const expectedHmac = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    const match = timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex'),
    )
    return match ? { ok: true } : { ok: false, reason: 'hmac_mismatch' }
  } catch {
    return { ok: false, reason: 'hmac_error' }
  }
}

async function captchaHandler(fastify: FastifyInstance, options: any) {
  fastify.get('/check', async (request, _reply) => {
    const { userId, token } = request.query as any

    const parsedUserId = Number(userId)
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return { result: false }
    }
    if (!token || typeof token !== 'string') {
      return { result: false }
    }

    const user = await findUserById(parsedUserId)
    if (!user || !user.suspicionDices) return { result: false }

    const expectedKills = user.suspicionDices - 101
    const verification = verifyCaptchaToken(
      parsedUserId,
      token,
      expectedKills,
      user.captchaNonce,
      user.captchaIssuedAt,
    )
    if (!verification.ok) {
      logger.info(
        `Captcha rejected for ${user.id}: ${verification.reason}`,
      )
      return { result: false }
    }

    logger.info(
      `Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`,
    )
    user.suspicionDices = 0
    user.captchaNonce = undefined
    user.captchaIssuedAt = undefined
    await user.save()
    await options.bot.api.sendMessage(
      parsedUserId,
      i18n.t(user.language, 'dice.captcha_solved'),
    )
    return { result: true }
  })
}

export default captchaHandler
