/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { Address } from "@ton/core";
import { Composer, InputFile } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { chatAction } from "@grammyjs/auto-chat-action";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { findAllByCreated } from "#root/bot/models/user";
import { addCNFT, getAllCNFTs } from "#root/bot/models/cnft";
import { referralsCount } from "#root/bot/models/vote";
import { logger } from "#root/logger";
import fs from "node:fs";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

async function addAddressesToDatabase(ctx: Context) {
  const users = await findAllByCreated();
  for (const u of users) {
    const address = Address.parse(u.wallet!);
    const referrals = await referralsCount(u.id);
    try {
      const userId = u.id;
      const result = await addCNFT(
        userId,
        address,
        u.votes,
        referrals,
        u.minted ?? false,
        u.diceWinner ?? false,
      );
      logger.info(`(${result.index}) Wallet ${result.wallet} was added`);
    } catch (error) {
      logger.error((error as Error).message);
    }
  }
  const cNFTs = await getAllCNFTs();
  const wallets = cNFTs.map((c) => c.wallet).join("\n");
  const data = Buffer.from(wallets);
  const filename = `${new Date().toISOString().split("T")[0]}.txt`;
  const fp = `./data/${filename}`;
  fs.writeFileSync(fp, data);
  await ctx.replyWithDocument(new InputFile(data, filename));
}

feature.command(
  "addresses",
  logHandle("command-addresses"),
  chatAction("upload_document"),
  async (ctx) => {
    addAddressesToDatabase(ctx).catch((error) => ctx.reply(error.message));
    await ctx.reply("Parsing  started!");
  },
);

export { composer as addressesFeature };
