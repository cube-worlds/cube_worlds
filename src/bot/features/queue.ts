/* eslint-disable unicorn/no-null */
import { Composer, InputFile, InputMediaBuilder } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { queueMenu, sendUserMetadata } from "#root/bot/keyboards/queue-menu.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { config } from "#root/config.js";
import { Address, toNano } from "@ton/core";
import { PhotoSize } from "@grammyjs/types";
import { changeImageData } from "#root/bot/callback-data/image-selection.js";
import { SelectImageButton, photoKeyboard } from "#root/bot/keyboards/photo.js";
import { NftCollection } from "#root/bot/models/nft-collection.js";
import { openWallet, waitSeqno } from "#root/bot/helpers/ton.js";
import { NftItem, nftMintParameters } from "#root/bot/models/nft-item.js";
import { pinFileToIPFS, pinJSONToIPFS } from "#root/bot/helpers/ipfs.js";
import { generate } from "#root/bot/helpers/generation.js";
import { randomAttributes } from "#root/bot/helpers/attributes.js";
import { findUserById } from "#root/bot/models/user.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  return ctx.reply(ctx.t("queue"), { reply_markup: queueMenu });
});

feature.callbackQuery(
  changeImageData.filter(),
  logHandle("keyboard-image-select"),
  async (ctx) => {
    try {
      const selectedUserId = ctx.dbuser.selectedUser;
      if (!selectedUserId) {
        return ctx.reply(ctx.t("wrong"));
      }
      const selectedUser = await findUserById(selectedUserId);
      if (!selectedUser) {
        return ctx.reply(ctx.t("wrong"));
      }
      const { select } = changeImageData.unpack(ctx.callbackQuery.data);
      ctx.editMessageReplyMarkup({});
      switch (select) {
        case SelectImageButton.Refresh: {
          if (!selectedUser.avatar) {
            return ctx.reply(ctx.t("wrong"));
          }
          ctx.chatAction = "upload_document";
          const nextItemIndex = await NftCollection.fetchNextItemIndex();
          const generatedFilePath = await generate(
            selectedUser.avatar,
            nextItemIndex,
          );
          const inputFile = new InputFile(generatedFilePath);
          const newMedia = InputMediaBuilder.photo(inputFile);
          const newMessage = await ctx.editMessageMedia(newMedia, {
            reply_markup: { inline_keyboard: photoKeyboard },
          });
          ctx.logger.error(newMessage);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fileId = (newMessage as any).photo.sort(
            (a: PhotoSize, b: PhotoSize) =>
              (b.file_size ?? 0) - (a.file_size ?? 0),
          )[0].file_id;
          const file = await ctx.api.getFile(fileId);
          selectedUser.image = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
          await selectedUser.save();
          break;
        }
        case SelectImageButton.Description: {
          break;
        }

        case SelectImageButton.Upload: {
          const nextItemIndex = await NftCollection.fetchNextItemIndex();
          const ipfsImageHash = await pinFileToIPFS(
            nextItemIndex,
            selectedUser.image ?? "",
          );
          ctx.logger.info(ipfsImageHash);
          const json = {
            name: selectedUser.name,
            description: selectedUser.description,
            image: `ipfs://${ipfsImageHash}`,
            attributes: randomAttributes(),
          };
          ctx.logger.info(json);
          const ipfsJSONHash = await pinJSONToIPFS(nextItemIndex, json);
          selectedUser.nftImage = ipfsImageHash;
          selectedUser.nftJson = ipfsJSONHash;
          await selectedUser.save();
          await sendUserMetadata(ctx, selectedUser, true);
          break;
        }
        case SelectImageButton.Done: {
          if (!selectedUser.nftDescription) {
            return ctx.reply("Empty description");
          }
          if (!selectedUser.nftJson || !selectedUser.nftImage) {
            return ctx.reply("Empty NFT metadata");
          }
          ctx.chatAction = "upload_document";

          const nextItemIndex = await NftCollection.fetchNextItemIndex();

          const wallet = await openWallet(config.MNEMONICS.split(" "));
          const item = new NftItem();
          const userAddress = Address.parse(selectedUser.wallet ?? "");
          const parameters: nftMintParameters = {
            queryId: 0,
            itemOwnerAddress: userAddress,
            itemIndex: nextItemIndex,
            amount: toNano("0.01"),
            commonContentUrl: `ipfs://${selectedUser.nftJson}`,
          };
          ctx.logger.info(parameters);
          const seqno = await item.deploy(wallet, parameters);
          await waitSeqno(seqno, wallet);
          const nft = await NftCollection.getNftAddressByIndex(nextItemIndex);
          await ctx.reply(
            `https://${config.TESTNET ? "testnet." : ""}getgems.io/collection/${config.COLLECTION_ADDRESS}/${nft.toString()}`,
            { link_preview_options: { is_disabled: true } },
          );
          break;
        }
        default: {
          break;
        }
      }
    } catch (error) {
      ctx.logger.warn(error as Error);
      await ctx.reply((error as Error).message);
    }
    ctx.chatAction = null;
  },
);

export { composer as queueFeature };
