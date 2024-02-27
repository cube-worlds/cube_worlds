/* eslint-disable unicorn/no-null */
import { Composer, InputMediaBuilder } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { queueMenu } from "#root/bot/keyboards/queue-menu.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { config } from "#root/config.js";
import { Address, toNano } from "ton-core";
import { changeImageData } from "../callback-data/image-selection.js";
import { getUserProfileFile } from "../helpers/photo.js";
import { SelectImageButton, photoKeyboard } from "../keyboards/photo.js";
import { NftCollection, mintParameters } from "../models/nft-collection.js";
import { openWallet, waitSeqno } from "../helpers/ton.js";
import { NftItem } from "../models/nft-item.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  return ctx.reply(ctx.t("queue"), { reply_markup: queueMenu });
});

feature.callbackQuery(
  changeImageData.filter(),
  logHandle("keyboard-image-select"),
  async (ctx) => {
    const { select } = changeImageData.unpack(ctx.callbackQuery.data);
    switch (select) {
      case SelectImageButton.Refresh: {
        // TODO: change to AI generated image
        const photo = await getUserProfileFile(ctx);
        if (!photo) {
          return ctx.reply(ctx.t("wrong"));
        }

        const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${photo.file_path}`;
        ctx.dbuser.image = photoUrl;
        ctx.dbuser.save();

        const newMedia = InputMediaBuilder.photo(photo.file_id);
        ctx.editMessageMedia(newMedia, {
          reply_markup: { inline_keyboard: photoKeyboard },
        });
        break;
      }
      case SelectImageButton.Done: {
        ctx.chatAction = "upload_document";
        const address = Address.parse(config.COLLECTION_ADDRESS);
        const testnet = true;
        const nextItemIndex = await NftCollection.fetchNextItemIndex(
          address,
          testnet,
        );
        const wallet = await openWallet(config.MNEMONICS.split(" "), true);
        const item = new NftItem();
        const userAddress = Address.parse(ctx.dbuser.wallet ?? "");
        const parameters: mintParameters = {
          queryId: 0,
          itemOwnerAddress: userAddress,
          itemIndex: nextItemIndex,
          amount: toNano("0.05"),
          contentUri:
            "ipfs://QmXXjER4hMHLp6ESJFG21A7yrWaoBE57cLyAHKyt1XiFpF/5.json",
        };
        const seqno = await item.deploy(wallet, address, parameters);
        await waitSeqno(seqno, wallet);
        const nftAddress = await NftItem.getAddressByIndex(
          address,
          nextItemIndex,
        );
        ctx.reply(nftAddress.toString());
        break;
      }
      default: {
        break;
      }
    }
  },
);

export { composer as queueFeature };
