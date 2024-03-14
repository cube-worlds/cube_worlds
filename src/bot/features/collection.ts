import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { NftCollection } from "#root/bot/models/nft-collection.js";
import { config } from "#root/config.js";
import { chatAction } from "@grammyjs/auto-chat-action";
import { openWallet, waitSeqno } from "#root/bot/helpers/ton.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command(
  "collection",
  logHandle("command-collection"),
  chatAction("upload_document"),
  async (ctx) => {
    if (config.COLLECTION_ADDRESS) {
      return ctx.reply("Collection already deployed!");
    }
    const wallet = await openWallet(config.MNEMONICS!.split(" "));
    const collectionData = {
      ownerAddress: wallet.contract.address,
      royaltyPercent: 0.49,
      royaltyAddress: wallet.contract.address,
      nextItemIndex: 0,
      collectionContentUrl: "",
      commonContentUrl: "",
    };
    const collection = new NftCollection(collectionData);
    const seqno = await collection.deploy(wallet);
    ctx.logger.info(`Collection will be deployed at: ${collection.address}`);
    await waitSeqno(seqno, wallet);
    ctx.reply(`Collection deployed: ${collection.address}`);
  },
);

export { composer as collectionFeature };
