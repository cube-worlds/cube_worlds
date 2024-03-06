/* eslint-disable unicorn/no-null */
import { Composer, InputFile, InputMediaBuilder } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { queueMenu } from "#root/bot/keyboards/queue-menu.js";
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
      const user = await findUserById(selectedUserId);
      if (!user) {
        return ctx.reply(ctx.t("wrong"));
      }
      ctx.chatAction = "upload_document";
      const { select } = changeImageData.unpack(ctx.callbackQuery.data);
      switch (select) {
        case SelectImageButton.Refresh: {
          if (!user.avatar) {
            return ctx.reply(ctx.t("wrong"));
          }
          const nextItemIndex = await NftCollection.fetchNextItemIndex();
          const generatedFilePath = await generate(user.avatar, nextItemIndex);
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
          user.image = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
          user.save();
          break;
        }
        case SelectImageButton.Done: {
          ctx.editMessageReplyMarkup({});

          const nextItemIndex = await NftCollection.fetchNextItemIndex();

          const ipfsImageHash = await pinFileToIPFS(
            nextItemIndex,
            user.image ?? "",
          );
          ctx.logger.info(ipfsImageHash);
          const json = {
            name: user.name,
            description: user.description,
            image: `ipfs://${ipfsImageHash}`,
            attributes: randomAttributes(),
          };
          ctx.logger.info(json);
          const ipfsJSONHash = await pinJSONToIPFS(nextItemIndex, json);

          const wallet = await openWallet(config.MNEMONICS.split(" "));
          const item = new NftItem();
          const userAddress = Address.parse(user.wallet ?? "");
          const parameters: nftMintParameters = {
            queryId: 0,
            itemOwnerAddress: userAddress,
            itemIndex: nextItemIndex,
            amount: toNano("0.01"),
            commonContentUrl: `ipfs://${ipfsJSONHash}`,
          };
          ctx.logger.info(parameters);
          const seqno = await item.deploy(wallet, parameters);
          await waitSeqno(seqno, wallet);
          const nft = await NftCollection.getNftAddressByIndex(nextItemIndex);
          ctx.reply(
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
      return ctx.reply((error as Error).message);
    }
  },
);

export { composer as queueFeature };
