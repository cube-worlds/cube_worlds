/* eslint-disable @typescript-eslint/no-explicit-any */
import { findUserById } from "#root/bot/models/user";
import { config } from "#root/config";
import { validate } from "@tma.js/init-data-node";
import { FastifyInstance } from "fastify";

const authHandler = (
  fastify: FastifyInstance,
  _options: unknown,
  done: () => void,
) => {
  fastify.post("/:userId", async (request, _reply) => {
    const { userId } = request.params as any;
    if (!userId) {
      return { error: "No userId provided" };
    }
    const { initData } = request.body as any;
    if (!initData) {
      return { error: `No initData or hash provided` };
    }
    try {
      validate(initData, config.BOT_TOKEN, { expiresIn: 86_400 });
      const user = await findUserById(userId);
      if (!user) {
        return { error: "User not found" };
      }
      return { id: user.id, language: user.language, wallet: user.wallet };
    } catch (error_) {
      return { error: error_ };
    }
  });

  done();
};
export default authHandler;
