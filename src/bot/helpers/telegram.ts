import { config } from "#root/config";
import { Api, InputMediaBuilder, RawApi } from "grammy";
import { TranslationVariables } from "@grammyjs/i18n";
import { logger } from "#root/logger";
import {
  findMintedWithDate,
  findQueue,
  findUserById,
  placeInLine,
} from "../models/user";
import { getRandomCoolEmoji } from "./emoji";
import { bigIntWithCustomSeparator } from "./numbers";
import { i18n } from "../i18n";
import { linkToIPFSGateway } from "./ipfs";

interface Languages {
  ru: string;
  en: string;
}

function getCubeChats(): Languages {
  return config.isProd
    ? { ru: "@cube_worlds_chat_ru", en: "@cube_worlds_chat" }
    : { ru: "@viz_cx", en: "@viz_cx" };
}

function getCubeChannels(): Languages {
  return config.isProd
    ? { ru: "@cube_worlds_ru", en: "@cube_worlds" }
    : { ru: "@viz_blockchain", en: "@viz_blockchain" };
}

export function getCubeChat(lang: string): string {
  const chats = getCubeChats();
  if (lang === "ru") {
    return chats.ru;
  }
  return chats.en;
}

export function getCubeChannel(lang: string): string {
  const channels = getCubeChannels();
  if (lang === "ru") {
    return channels.ru;
  }
  return channels.en;
}

export function adminIndex(userId: number): number {
  if (!config.BOT_ADMINS.includes(userId)) {
    throw new Error("Not admin");
  }
  return config.BOT_ADMINS.indexOf(userId);
}

export async function sendMessageToAdmins(api: Api<RawApi>, message: string) {
  // eslint-disable-next-line no-restricted-syntax
  for (const adminId of config.BOT_ADMINS) {
    // eslint-disable-next-line no-await-in-loop
    await api.sendMessage(adminId, message);
  }
}

export function inviteTelegramUrl(userId: number) {
  return `https://t.me/${config.BOT_NAME}?start=${userId}`;
}

export function shareTelegramLink(userId: number, text: string): string {
  const url = inviteTelegramUrl(userId);
  return `https://t.me/share/url?url=${encodeURI(url)}&text=${encodeURIComponent(text)}`;
}

export async function sendPlaceInLine(
  api: Api<RawApi>,
  userId: number,
  sendAnyway = true,
): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }
  const place = (await placeInLine(user.votes)) ?? 0;
  const lastSendedPlace = user.lastSendedPlace ?? Number.MAX_SAFE_INTEGER;
  const placeDecreased = place < lastSendedPlace;
  if (sendAnyway || placeDecreased) {
    const inviteLink = inviteTelegramUrl(user.id);
    const shareLink = shareTelegramLink(
      user.id,
      i18n.t(user.language, "mint.share"),
    );
    const titleKey = `speedup.${user.minted ? "title_minted" : "title_not_minted"}`;
    const titleVariables: TranslationVariables<string> = {
      points: bigIntWithCustomSeparator(user.votes),
    };
    await api.sendMessage(
      user.id,
      `${i18n.t(user.language, titleKey, titleVariables)}

${i18n.t(user.language, "speedup.variants", {
  shareLink,
  inviteLink,
  collectionOwner: config.COLLECTION_OWNER,
})}`,
    );
    // eslint-disable-next-line no-param-reassign
    user.lastSendedPlace = place;
    await user.save();
    logger.info(`Points ${user.votes} for user ${user.id}`);
    return true;
  }
  return false;
}

export async function sendNewPlaces(api: Api<RawApi>) {
  // TODO: update logic to get only who not active too long and update this property
  const users = await findQueue();
  // eslint-disable-next-line no-restricted-syntax
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    await sendPlaceInLine(api, user.id, false);
  }
}

export async function sendPreviewNFT(
  api: Api<RawApi>,
  chat: string | number,
  lang: string,
  ipfsImageHash: string,
  nftUrl: string,
  nftNumber: number,
  diceWinner: boolean,
) {
  const collection = "cubeworlds";
  const collectionLink = `<a href="https://getgems.io/${collection}?utm_campaign=${collection}&utm_source=inline&utm_medium=collection">Cube Worlds</a>`;
  const emoji1 = diceWinner ? "🎲" : getRandomCoolEmoji().emoji;
  const emoji2 = diceWinner ? "🎲" : getRandomCoolEmoji().emoji;
  const caption = i18n.t(
    lang,
    `queue.${diceWinner ? `new_nft_dice` : `new_nft`}`,
    {
      emoji1,
      emoji2,
      number: nftNumber,
      collectionLink,
    },
  );
  const linkTitle = i18n.t(lang, "queue.new_nft_button");
  // eslint-disable-next-line no-await-in-loop
  return api.sendPhoto(chat, linkToIPFSGateway(ipfsImageHash), {
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: linkTitle,
            url: `${nftUrl}?utm_campaign=${collection}&utm_source=inline&utm_medium=nft`,
          },
        ],
      ],
    },
  });
}

export async function sendToGroupsNewNFT(
  api: Api<RawApi>,
  ipfsImageHash: string,
  nftNumber: number,
  nftUrl: string,
  diceWinner: boolean,
) {
  try {
    const chats = getCubeChats();
    // eslint-disable-next-line no-restricted-syntax
    for (const [lang, chat] of Object.entries(chats)) {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendPreviewNFT(
        api,
        chat,
        lang,
        ipfsImageHash,
        nftUrl,
        nftNumber,
        diceWinner,
      );
      // eslint-disable-next-line no-await-in-loop
      await api.setMessageReaction(result.chat.id, result.message_id, [
        getRandomCoolEmoji(),
      ]);
    }
  } catch (error) {
    logger.error(error);
    await sendMessageToAdmins(api, `Error message new NFT to chat: ${error}`);
  }
}

export async function sendPostToChannels(api: Api<RawApi>) {
  const channels = getCubeChannels();
  const allMinted = await findMintedWithDate();
  const imagesCount = 9;
  if (allMinted.length >= imagesCount && allMinted.length % imagesCount === 0) {
    const shortList = allMinted.slice(0, imagesCount);
    const images = shortList.reverse().map((u) =>
      InputMediaBuilder.photo(linkToIPFSGateway(u.nftImage ?? ""), {
        caption: `@cube_worlds_bot | [${u.name ?? ""}](${u.nftUrl ?? ""})`,
        parse_mode: "Markdown",
      }),
    );
    // eslint-disable-next-line no-restricted-syntax
    for (const [_lang, channel] of Object.entries(channels)) {
      // eslint-disable-next-line no-await-in-loop
      await api.sendMediaGroup(channel, images, {
        disable_notification: true,
      });
    }
  }
}
