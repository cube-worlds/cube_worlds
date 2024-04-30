import fastify from "fastify";
import { webhookCallback } from "grammy";
import type { Bot } from "#root/bot/index.js";
import { logger } from "#root/logger.js";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { findUserById } from "./bot/models/user";

export const createServer = async (bot: Bot) => {
  const server = fastify({
    logger,
  });

  server.setErrorHandler(async (error, request, response) => {
    logger.error(error);

    await response.status(500).send({ error: "Oops! Something went wrong." });
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  logger.info(`Dir ${__dirname}`);
  await server.register(fastifyStatic, {
    root: path.join(path.join(__dirname, "web"), "dist"),
    prefix: "/",
  });

  server.setNotFoundHandler(async (_request, reply) => {
    await reply.sendFile("index.html");
  });

  server.get("/check", async (request, _) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userId, count } = request.query as any;
    if (userId && count) {
      const user = await findUserById(userId);
      if (!user || !user.suspicionDices) return { result: false };
      if (user.suspicionDices === Number(count)) {
        user.suspicionDices = 0;
        await user.save();
        return { result: true };
      }
    }
    return { result: false };
  });

  // server.get("/", () => ({ status: true }));

  server.post(
    `/${bot.token}`,
    webhookCallback(bot, "fastify", "throw", 15_000),
  );

  return server;
};
