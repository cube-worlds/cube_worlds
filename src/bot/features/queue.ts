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
import { NftCollection } from "../models/nft-collection.js";
import { openWallet, waitSeqno } from "../helpers/ton.js";
import { NftItem, nftMintParameters } from "../models/nft-item.js";
import { pinFileToIPFS, pinJSONToIPFS } from "../helpers/ipfs.js";

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
        // TODO: change to selected user
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
        ctx.editMessageReplyMarkup({});

        const user = ctx.dbuser; // TODO: change to selected user
        const address = Address.parse(config.COLLECTION_ADDRESS);
        const testnet = true;
        const nextItemIndex = await NftCollection.fetchNextItemIndex(
          address,
          testnet,
        );

        const ipfsImageHash = await pinFileToIPFS(
          nextItemIndex,
          user.image ?? "",
        );
        ctx.logger.info(ipfsImageHash);
        const json = {
          name: user.name,
          description: user.description,
          image: `ipfs://${ipfsImageHash}`,
          attributes: [{ trait_type: "strength", value: "20" }],
        };
        ctx.logger.info(json);
        const ipfsJSONHash = await pinJSONToIPFS(nextItemIndex, json);

        const wallet = await openWallet(config.MNEMONICS.split(" "), testnet);
        const item = new NftItem();
        const userAddress = Address.parse(user.wallet ?? "");
        const parameters: nftMintParameters = {
          queryId: 0,
          itemOwnerAddress: userAddress,
          itemIndex: nextItemIndex,
          amount: toNano("0.05"),
          commonContentUrl: `ipfs://${ipfsJSONHash}`,
        };
        ctx.logger.info(parameters);
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
