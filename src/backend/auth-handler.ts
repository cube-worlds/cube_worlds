/* eslint-disable @typescript-eslint/no-explicit-any */
import { findUserById } from "#root/bot/models/user"
import { config } from "#root/config"
import { logger } from "#root/logger"
import { validate } from "@tma.js/init-data-node"
import { FastifyInstance } from "fastify"

export const authHandler = (
  fastify: FastifyInstance,
  _options: unknown,
  done: () => void,
) => {
  // eslint-disable-next-line no-unused-vars
  fastify.post("/:userId", async (request, _reply) => {
    const { userId } = request.params as any
    if (!userId) {
      return { error: "No userId provided" }
    }
    const { initData, referId } = request.body as any
    if (!initData) {
      return { error: `No initData or hash provided` }
    }
    try {
      validate(initData, config.BOT_TOKEN, { expiresIn: 86_400 })
      const user = await findUserById(userId)
      if (!user) {
        return { error: "User not found" }
      }
      const userAlreadyInvited = user.wallet || user.referalId
      if (referId && !userAlreadyInvited) {
        const receiverId = Number(referId)
        const receiver = await findUserById(receiverId)
        if (receiver && !(receiverId === user.id)) {
          user.referalId = receiverId
          await user.save()
          logger.info("Referrer added successfully")
        } else {
          logger.error("Referrer not found or same as user")
        }
      } else {
        logger.error("referId undefined or user already invited")
      }
      return {
        id: user.id,
        language: user.language,
        wallet: user.wallet,
        referalId: user.referalId,
      }
    } catch (error_) {
      return { error: error_ }
    }
  })

  done()
}
