import { i18n } from '#root/bot/i18n'
import { findUserById } from '#root/bot/models/user'
import { logger } from '@typegoose/typegoose/lib/logSettings'

function decryptNumber(key: string, encryptedNumber: string): number {
  const encryptedData: string = atob(encryptedNumber)
  let decryptedData: string = ''

  for (let index = 0; index < encryptedData.length; index++) {
    const fromData = encryptedData.codePointAt(index)
    const fromKey = key.codePointAt(index % key.length)
    if (!fromData || !fromKey)
      break

    const charCode: number = fromData ^ fromKey
    decryptedData += String.fromCodePoint(charCode)
  }
  return Number.parseInt(decryptedData, 10)
}

function checkCaptcha(fastify: any, _options: any, done: () => void) {
  fastify.get('/check', async (request: any, _reply: any) => {
    const { userId, count } = request.query as any
    const data = decryptNumber('jsdIUbvFtZgd', count)
    if (userId && data) {
      const user = await findUserById(userId)
      if (!user || !user.suspicionDices)
        return { result: false }
      if (user.suspicionDices === Number(data) + 1 + 100) {
        logger.info(`Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`)
        user.suspicionDices = 0
        await user.save()
        await _options.bot.api.sendMessage(userId, i18n.t(user.language, 'dice.captcha_solved'))
        return { result: true }
      }
    }
    return { result: false }
  })
  done()
}
export default checkCaptcha
