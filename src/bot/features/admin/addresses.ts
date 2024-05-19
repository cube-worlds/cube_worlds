/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { Address } from "@ton/core";
import { Composer, InputFile } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { chatAction } from "@grammyjs/auto-chat-action";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { findWhales } from "#root/bot/models/user";
import { addCNFT, getAllCNFTs } from "#root/bot/models/cnft";
import { referralsCount } from "#root/bot/models/vote";
import { logger } from "#root/logger";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command(
  "addresses",
  logHandle("command-addresses"),
  chatAction("upload_document"),
  async (ctx) => {
    const users = await findWhales(Number.MAX_SAFE_INTEGER);
    for (const u of users) {
      const address = Address.parse(u.wallet!);
      const referrals = await referralsCount(u.id);
      try {
        const result = await addCNFT(
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
    await ctx.replyWithDocument(new InputFile(data, filename));
  },
);

export { composer as addressesFeature };
