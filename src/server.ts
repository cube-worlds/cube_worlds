import fastify from "fastify";
import { webhookCallback } from "grammy";
import type { Bot } from "#root/bot/index.js";
import { logger } from "#root/logger.js";
import path from "node:path";
import fastifyStatic from "@fastify/static";

export const createServer = async (bot: Bot) => {
  const server = fastify({
    logger,
  });

  server.setErrorHandler(async (error, request, response) => {
    logger.error(error);

    await response.status(500).send({ error: "Oops! Something went wrong." });
  });

  await server.register(fastifyStatic, {
    root: path.join(path.join(import.meta.dirname, "web"), "dist"),
    prefix: "/",
  });

  server.setNotFoundHandler(async (_request, reply) => {
    await reply.sendFile("index.html");
  });

  // server.get("/", () => ({ status: true }));

  server.post(
    `/${bot.token}`,
    webhookCallback(bot, "fastify", "throw", 15_000),
  );

  return server;
};
