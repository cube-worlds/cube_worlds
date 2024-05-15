import fastify from "fastify";
import { webhookCallback } from "grammy";
import type { Bot } from "#root/bot/index.js";
import { logger } from "#root/logger.js";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { Address } from "@ton/core";
import { User, findUserById, findWhales } from "./bot/models/user";
import { i18n } from "./bot/i18n";

function decryptNumber(key: string, encryptedNumber: string): number {
  const encryptedData: string = atob(encryptedNumber);
  let decryptedData: string = "";
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < encryptedData.length; index++) {
    const fromData = encryptedData.codePointAt(index);
    const fromKey = key.codePointAt(index % key.length);
    if (!fromData || !fromKey) break;
    // eslint-disable-next-line no-bitwise
    const charCode: number = fromData ^ fromKey;
    decryptedData += String.fromCodePoint(charCode);
  }
  return Number.parseInt(decryptedData, 10);
}

export const createServer = async (bot: Bot) => {
  const server = fastify({
    logger,
  });

  server.setErrorHandler(async (error, _request, response) => {
    logger.error(error);

    await response.status(500).send({ error: "Oops! Something went wrong." });
  });

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

  server.get("/check", async (request, _) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userId, count } = request.query as any;
    const data = decryptNumber("foJhCnaPow", count);
    if (userId && data) {
      const user = await findUserById(userId);
      if (!user || !user.suspicionDices) return { result: false };
      if (user.suspicionDices === Number(data) + 1 + 100) {
        logger.info(
          `Solved captcha from ${user.id} with ${user.suspicionDices} suspicion dices`,
        );
        user.suspicionDices = 0;
        await user.save();
        await bot.api.sendMessage(
          userId,
          i18n.t(user.language, "dice.captcha_solved"),
        );
        return { result: true };
      }
    }
    return { result: false };
  });

  server.get("/cnft/1/items", async () => {
    const users = await findWhales(10_000);
    const items = users.map((u: User, index: number) => {
      return {
        metadata: {
          owner: Address.parse(u.wallet!).toRawString(),
          individual_content: "cell",
        },
        index,
      };
    });
    return { items, last_index: users.length - 1 };
  });

  server.get("/cnft/1/items/:index", (request, _reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { index } = request.params as any;
    return {
      item: {
        metadata: {
          owner:
            "0:0000000000000000000000000000000000000000000000000000000000000000",
          individual_content: "te6cckEBAQEACAAADDAuanNvbuTiyMU=",
        },
        index,
      },
      proof_cell:
        "te6cckEBBgEAeQACAAEDAUOAFa1KqA2Oswxbo4Rgh/q6NEaPLuK9o3fo1TFGn+MySjqQAgAMMi5qc29uAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBQF4S3GMDJY/HoZd6TCREIOnCaYlF23hNzJaSsfMd1S7nBQAA8muEeQ==",
    };
  });

  server.post(
    `/${bot.token}`,
    webhookCallback(bot, "fastify", "throw", 15_000),
  );

  return server;
};
