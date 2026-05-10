import type { FastifyInstance } from 'fastify'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { i18n } from '#root/common/i18n'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'

/**
 * Generate HMAC-signed captcha token for a user.
 * Called server-side when building the captcha URL.
 */
export function generateCaptchaToken(
  userId: number,
  expectedKills: number,
): string {
  const secret = process.env.BOT_TOKEN ?? ''
  const payload = `captcha:${userId}:${expectedKills}`
  const hmac = createHmac('sha256', secret).update(payload).digest('hex')
  return `${expectedKills}:${hmac}`
}

function verifyCaptchaToken(
  userId: number,
  token: string,
  expectedKills: number,
): boolean {
  const secret = process.env.BOT_TOKEN ?? ''
  if (!secret) return false

  const parts = token.split(':')
  if (parts.length !== 2) return false

  const [killsStr, providedHmac] = parts
  if (Number(killsStr) !== expectedKills) return false

  const payload = `captcha:${userId}:${expectedKills}`
  const expectedHmac = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex'),
    )
  } catch {
    return false
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
    if (!verifyCaptchaToken(parsedUserId, token, expectedKills)) {
      return { result: false }
    }

    logger.info(
      `Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`,
    )
    user.suspicionDices = 0
    await user.save()
    await options.bot.api.sendMessage(
      parsedUserId,
      i18n.t(user.language, 'dice.captcha_solved'),
    )
    return { result: true }
  })
}

export default captchaHandler
