import { config } from "#root/config";
import { Api, RawApi } from "grammy";
import { TranslationVariables } from "@grammyjs/i18n";
import { logger } from "#root/logger";
import { findQueue, findUserById, placeInLine } from "../models/user";
import { getRandomCoolEmoji } from "./emoji";
import { bigIntWithCustomSeparator } from "./numbers";
import { i18n } from "../i18n";
import { linkToIPFSGateway } from "./ipfs";

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
    const chats = config.isProd
      ? { ru: "@cube_worlds_chat_ru", en: "@cube_worlds_chat" }
      : { ru: "@viz_blockchain", en: "@viz_blockchain" };
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
