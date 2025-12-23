import type { FastifyInstance } from 'fastify'
import { i18n } from '#root/common/i18n'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'

function decryptNumber(key: string, encryptedNumber: string): number {
  const encryptedData = atob(encryptedNumber)
  let decryptedData = ''
  for (let i = 0; i < encryptedData.length; i++) {
    const fromData = encryptedData.codePointAt(i)
    const fromKey = key.codePointAt(i % key.length)
    if (!fromData || !fromKey) break
    decryptedData += String.fromCodePoint(fromData ^ fromKey)
  }
  return Number.parseInt(decryptedData, 10)
}

async function captchaHandler(fastify: FastifyInstance, options: any) {
  fastify.get('/check', async (request, _reply) => {
    const { userId, count } = request.query as any
    const data = decryptNumber('jsdIUbvFtZgdKlq', count)
    if (!userId || !data) return { result: false }
    const user = await findUserById(userId)
    if (!user || !user.suspicionDices) return { result: false }
    if (user.suspicionDices === Number(data) + 101) {
      logger.info(
        `Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`,
      )
      user.suspicionDices = 0
      await user.save()
      await options.bot.api.sendMessage(
        userId,
        i18n.t(user.language, 'dice.captcha_solved'),
      )
      return { result: true }
    }
    return { result: false }
  })
}

export default captchaHandler
