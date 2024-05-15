import fastify from "fastify";
import { webhookCallback } from "grammy";
import type { Bot } from "#root/bot/index.js";
import { logger } from "#root/logger.js";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import cnft from "./backend/cnft";
import checkCaptcha from "./backend/captcha";

export const createServer = async (bot: Bot) => {
  const server = fastify({
    logger,
  });

  server.setErrorHandler(async (error, _request, response) => {
    logger.error(error);

    await response.status(500).send({ error: "Oops! Something went wrong." });
  });

  await server.register(cnft, { prefix: "/api/v1/cnft" });

  await server.register(checkCaptcha, { bot });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  await server.register(fastifyStatic, {
    root: path.join(path.join(__dirname, "frontend"), "dist"),
    prefix: "/",
  });
  await server.register(fastifyStatic, {
    root: path.join(path.join(__dirname, "frontend"), "captcha"),
    prefix: "/captcha/",
    decorateReply: false,
  });

  server.setNotFoundHandler(async (_request, reply) => {
    await reply.sendFile("index.html");
  });

  server.post(
    `/${bot.token}`,
    webhookCallback(bot, "fastify", "throw", 15_000),
  );

  return server;
};
