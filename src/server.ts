import fastify from "fastify";
import { webhookCallback } from "grammy";
import type { Bot } from "#root/bot/index.js";
import { logger } from "#root/logger.js";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import nftHandler from "./backend/nft-handler";
import checkCaptcha from "./backend/captcha";

export const createServer = async (bot: Bot) => {
  const server = fastify({
    logger,
  });

  server.setErrorHandler(async (error, _request, response) => {
    logger.error(error);

    await response.status(500).send({ error: "Oops! Something went wrong." });
  });

  await server.register(nftHandler, { prefix: "/api/nft" });

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
  await server.register(fastifyStatic, {
    root: path.join(path.join(__dirname, "frontend"), "static"),
    prefix: "/static/",
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
