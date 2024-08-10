/* eslint-disable @typescript-eslint/no-explicit-any */
import { i18n } from "#root/bot/i18n"
import { findUserById } from "#root/bot/models/user"
import { logger } from "@typegoose/typegoose/lib/logSettings"

function decryptNumber(key: string, encryptedNumber: string): number {
  const encryptedData: string = atob(encryptedNumber)
  let decryptedData: string = ""
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < encryptedData.length; index++) {
    const fromData = encryptedData.codePointAt(index)
    const fromKey = key.codePointAt(index % key.length)
    if (!fromData || !fromKey) break
    // eslint-disable-next-line no-bitwise
    const charCode: number = fromData ^ fromKey
    decryptedData += String.fromCodePoint(charCode)
  }
  return Number.parseInt(decryptedData, 10)
}

const checkCaptcha = (fastify: any, _options: any, done: () => void) => {
  // eslint-disable-next-line no-unused-vars
  fastify.get("/check", async (request: any, _reply: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userId, count } = request.query as any
    const data = decryptNumber("foJhCnaPow", count)
    if (userId && data) {
      const user = await findUserById(userId)
      if (!user || !user.suspicionDices) return { result: false }
      if (user.suspicionDices === Number(data) + 1 + 100) {
        logger.info(
          `Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`,
        )
        user.suspicionDices = 0
        await user.save()
        await _options.bot.api.sendMessage(
          userId,
          i18n.t(user.language, "dice.captcha_solved"),
        )
        return { result: true }
      }
    }
    return { result: false }
  })
  done()
}
export default checkCaptcha
