/* eslint-disable unicorn/no-null */
import { Composer, InputFile } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import {
  photoCaption,
  queueMenu,
  sendUserMetadata,
} from "#root/bot/keyboards/queue-menu.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { config } from "#root/config.js";
import { Address, toNano } from "@ton/core";
import { PhotoSize } from "@grammyjs/types";
import { changeImageData } from "#root/bot/callback-data/image-selection.js";
import { SelectImageButton, photoKeyboard } from "#root/bot/keyboards/photo.js";
import { NftCollection } from "#root/bot/models/nft-collection.js";
import { openWallet, sleep, waitSeqno } from "#root/bot/helpers/ton.js";
import { NftItem, nftMintParameters } from "#root/bot/models/nft-item.js";
import { pinImageURLToIPFS, pinJSONToIPFS } from "#root/bot/helpers/ipfs.js";
import { generate } from "#root/bot/helpers/generation.js";
import { randomAttributes } from "#root/bot/helpers/attributes.js";
import { countUsers, findUserById } from "#root/bot/models/user.js";
import { ChatGPTAPI } from "chatgpt";
import { i18n } from "../i18n";
import { sendNewPlaces } from "../helpers/telegram";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter(isAdmin);

feature.command("queue", logHandle("command-queue"), async (ctx) => {
  const count = await countUsers(false);
  return ctx.reply(ctx.t("queue.title", { count }), {
    reply_markup: queueMenu,
  });
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
        case SelectImageButton.Description: {
          const api = new ChatGPTAPI({
            apiKey: config.OPENAI_API_KEY,
            completionParams: {
              max_tokens: 512,
            },
          });
          const name = selectedUser.name ?? "";
          const info = selectedUser.description ?? "";
          const result = await api.sendMessage(
            // `Write the beginning of the new RPG character's story named "${name}".
            `Write an inspiring text about a person named "${name}" who has decided to start a journey.
            You could also use this additional information "${info}" if it feels appropriate.
            Response MUST BE up to 500 characters maximum`,
          );
          selectedUser.nftDescription = result.text.slice(0, 700);
          await selectedUser.save();
          await sendUserMetadata(ctx, selectedUser);
          break;
        }

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
          // const newMedia = InputMediaBuilder.photo(inputFile);
          const newMessage = await ctx.replyWithPhoto(inputFile, {
            caption: photoCaption(selectedUser),
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: photoKeyboard,
            },
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

        case SelectImageButton.Upload: {
          if (!selectedUser.nftDescription) {
            return ctx.reply("Empty description");
          }
          if (!selectedUser.image) {
            return ctx.reply("Empty image");
          }
          const nextItemIndex = await NftCollection.fetchNextItemIndex();
          const ipfsImageHash = await pinImageURLToIPFS(
            nextItemIndex,
            selectedUser.image ?? "",
          );
          ctx.logger.info(ipfsImageHash);
          const json = {
            name: selectedUser.name,
            description: selectedUser.nftDescription,
            image: `ipfs://${ipfsImageHash}`,
            attributes: randomAttributes(),
          };
          ctx.logger.info(json);
          const ipfsJSONHash = await pinJSONToIPFS(nextItemIndex, json);
          selectedUser.nftImage = ipfsImageHash;
          selectedUser.nftJson = ipfsJSONHash;
          await selectedUser.save();
          await sendUserMetadata(ctx, selectedUser);
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

          selectedUser.minted = true;
          await selectedUser.save();

          await waitSeqno(seqno, wallet);
          const nft = await NftCollection.getNftAddressByIndex(nextItemIndex);

          const nftUrl = `https://${config.TESTNET ? "testnet." : ""}getgems.io/collection/${config.COLLECTION_ADDRESS}/${nft.toString()}`;
          selectedUser.nftUrl = nftUrl;
          await selectedUser.save();

          await sleep(30_000);

          await ctx.reply(nftUrl, {
            link_preview_options: { is_disabled: true },
          });

          await ctx.api.sendMessage(
            selectedUser.id,
            i18n.t(selectedUser.language, "queue.success", { url: nftUrl }),
          );

          await sendNewPlaces(ctx.api);
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
