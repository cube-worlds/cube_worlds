import { config } from "#root/config";
import { Api, RawApi } from "grammy";
import { DocumentType } from "@typegoose/typegoose";
import { TranslationVariables } from "@grammyjs/i18n";
import { logger } from "#root/logger";
import { User, countUsers, findQueue, placeInLine } from "../models/user";
import { i18n } from "../i18n";
import { sleep } from "./ton";
import { toEmoji } from "./emoji";
import { bigIntWithCustomSeparator } from "./numbers";

export async function sendMessageToAdmins(api: Api<RawApi>, message: string) {
  // eslint-disable-next-line no-restricted-syntax
  for (const adminId of config.BOT_ADMINS) {
    api.sendMessage(adminId, message);
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
  user: DocumentType<User>,
  sendAnyway = true,
): Promise<boolean> {
  const place = await placeInLine(user.votes);
  const totalPlaces = await countUsers(false);
  const lastSendedPlace = user.lastSendedPlace ?? Number.MAX_SAFE_INTEGER;
  const placeDecreased = place < lastSendedPlace;
  if (sendAnyway || placeDecreased) {
    const inviteLink = inviteTelegramUrl(user.id);
    const shareLink = shareTelegramLink(
      user.id,
      i18n.t(user.language, "mint.share"),
    );
    const titleKey = `speedup.${user.minted ? "title_minted" : "title_not_minted"}`;
    const titleVariables: TranslationVariables<string> = user.minted
      ? {
          points: bigIntWithCustomSeparator(user.votes),
        }
      : {
          place: toEmoji(place),
          total: toEmoji(totalPlaces),
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
    sendPlaceInLine(api, user, false);
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }
}
