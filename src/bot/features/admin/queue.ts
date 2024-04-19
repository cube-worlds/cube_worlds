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
import { openWallet, waitSeqno } from "#root/bot/helpers/ton.js";
import { NftItem, nftMintParameters } from "#root/bot/models/nft-item.js";
import {
  pinImageURLToIPFS,
  pinJSONToIPFS,
  unpin,
  warmIPFSHash,
} from "#root/bot/helpers/ipfs.js";
import {
  ClipGuidancePreset,
  SDSampler,
  generate,
} from "#root/bot/helpers/generation.js";
import { randomAttributes } from "#root/bot/helpers/attributes.js";
import { countUsers, findUserById } from "#root/bot/models/user.js";
import { ChatGPTAPI } from "chatgpt";
import { logger } from "#root/logger";
import {
  adminIndex,
  sendNewNFTMessage,
  // sendNewPlaces,
} from "../../helpers/telegram";
import { sendMintedMessage } from "../../middlewares/check-not-minted";

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
  async (ctx: Context) => {
    try {
      const selectedUserId = ctx.dbuser.selectedUser;
      if (!selectedUserId) {
        return ctx.reply(ctx.t("wrong"));
      }
      const selectedUser = await findUserById(selectedUserId);
      if (!selectedUser) {
        return ctx.reply(ctx.t("wrong"));
      }
      const { select } = changeImageData.unpack(ctx.callbackQuery?.data ?? "");
      try {
        await ctx.editMessageReplyMarkup();
      } catch {
        // do nothing
      }
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
            You could also use this additional information "${info}" if it feels appropriate, translate into English.
            Do NOT show text in original language. Do NOT show any quotation marks.
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
            adminIndex(ctx.dbuser.id),
            nextItemIndex,
            ctx.dbuser.positivePrompt ?? "",
            ctx.dbuser.negativePrompt ?? "",
            ctx.dbuser.strength ?? 0.35,
            ctx.dbuser.scale ?? 7,
            ctx.dbuser.steps ?? 30,
            ctx.dbuser.preset ?? ClipGuidancePreset.NONE,
            ctx.dbuser.sampler ?? SDSampler.K_DPMPP_2S_ANCESTRAL,
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
          const fileId = (newMessage as any).photo
            .filter((p: PhotoSize) => p.width === p.height)
            .sort(
              (a: PhotoSize, b: PhotoSize) =>
                (b.file_size ?? b.width) - (a.file_size ?? a.width),
            )[0].file_id;
          const file = await ctx.api.getFile(fileId);
          selectedUser.image = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
          await selectedUser.save();
          break;
        }

        case SelectImageButton.Avatar: {
          const nextAvatarNumber =
            ctx.dbuser.selectedUser === selectedUser.id
              ? (ctx.dbuser.avatarNumber ?? -1) + 1
              : 0;
          ctx.dbuser.avatarNumber = nextAvatarNumber;
          await ctx.dbuser.save();
          await sendUserMetadata(ctx, selectedUser);
          break;
        }

        case SelectImageButton.Upload: {
          if (!selectedUser.nftDescription) {
            return ctx.reply("Empty description");
          }
          if (!selectedUser.image) {
            return ctx.reply("Empty image");
          }

          if (selectedUser.nftImage && selectedUser.nftJson) {
            try {
              await unpin(selectedUser.nftImage);
              selectedUser.nftImage = "";
              await unpin(selectedUser.nftJson);
              selectedUser.nftJson = "";
              await selectedUser.save();
            } catch (error) {
              logger.info(`Unable to unpin IPFS files: ${error}`);
            }
          }

          const nextItemIndex = await NftCollection.fetchNextItemIndex();
          const ipfsImageHash = await pinImageURLToIPFS(
            adminIndex(ctx.dbuser.id),
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
          const ipfsJSONHash = await pinJSONToIPFS(
            adminIndex(ctx.dbuser.id),
            nextItemIndex,
            json,
          );
          selectedUser.nftImage = ipfsImageHash;
          selectedUser.nftJson = ipfsJSONHash;
          await selectedUser.save();
          await sendUserMetadata(ctx, selectedUser);
          warmIPFSHash(ipfsImageHash)
            .then((_) => {
              logger.info("Warm image successfully");
            })
            .catch((error) => {
              logger.error("Failed to warm image:", error);
            });
          warmIPFSHash(ipfsJSONHash)
            .then((_) => {
              logger.info("Warm json successfully");
            })
            .catch((error) => {
              logger.error("Failed to warm json:", error);
            });
          break;
        }

        case SelectImageButton.Done: {
          if (!selectedUser.nftDescription) {
            return ctx.reply("Empty description");
          }
          if (!selectedUser.nftJson || !selectedUser.nftImage) {
            return ctx.reply("Empty NFT metadata");
          }
          if (selectedUser.minted) {
            return ctx.reply("Already minted for this user!");
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

          selectedUser.minted = true;
          await selectedUser.save();

          const seqno = await item.deploy(wallet, parameters);

          await waitSeqno(seqno, wallet);

          const nft = await NftCollection.getNftAddressByIndex(nextItemIndex);

          const nftUrl = `https://${config.TESTNET ? "testnet." : ""}getgems.io/collection/${config.COLLECTION_ADDRESS}/${nft.toString()}`;
          selectedUser.nftUrl = nftUrl;
          await selectedUser.save();

          // TODO: uncomment after change logic
          // await sendNewPlaces(ctx.api);

          // send to admin first
          await sendMintedMessage(
            ctx.api,
            ctx.dbuser.id,
            selectedUser.language,
            selectedUser.nftUrl ?? "",
          );

          await sendMintedMessage(
            ctx.api,
            selectedUser.id,
            selectedUser.language,
            selectedUser.nftUrl ?? "",
          );

          await ctx.api.sendSticker(
            selectedUser.id,
            "CAACAgIAAxkBAAEq6zpmIPgeW-peX09nTeFVvHXneFJZaQACQxoAAtzjkEhebdhBXbkEnzQE",
          );

          await sendNewNFTMessage(
            ctx.api,
            selectedUser.nftImage ?? "",
            nextItemIndex,
            selectedUser.nftUrl ?? "",
          );
          break;
        }
        default: {
          break;
        }
      }
    } catch (error) {
      ctx.logger.error(error);
      const { message } = error as Error;
      await (message
        ? ctx.reply(`Error: ${message}`)
        : ctx.reply(ctx.t("wrong")));
    }
    ctx.chatAction = null;
  },
);

export { composer as queueFeature };
