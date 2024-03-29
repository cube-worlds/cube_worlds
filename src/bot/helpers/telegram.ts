import { config } from "#root/config";
import { Api, RawApi } from "grammy";
import { DocumentType } from "@typegoose/typegoose";
import { User, countUsers, findQueue, placeInLine } from "../models/user";
import { i18n } from "../i18n";
import { sleep } from "./ton";

function toEmoji(number: number): string {
  if (number === 10) {
    return "🔟";
  }
  return number
    .toString()
    .replaceAll("0", "0️⃣")
    .replaceAll("1", "1️⃣")
    .replaceAll("2", "2️⃣")
    .replaceAll("3", "3️⃣")
    .replaceAll("4", "4️⃣")
    .replaceAll("5", "5️⃣")
    .replaceAll("6", "6️⃣")
    .replaceAll("7", "7️⃣")
    .replaceAll("8", "8️⃣")
    .replaceAll("9", "9️⃣");
}

export async function sendPlaceInLine(
  api: Api<RawApi>,
  user: DocumentType<User>,
  sendAnyway = true,
) {
  const place = await placeInLine(user.votes);
  const totalPlaces = await countUsers(false);
  const lastSendedPlace = user.lastSendedPlace ?? Number.MAX_SAFE_INTEGER;
  const placeDecreased = place < lastSendedPlace;
  if (sendAnyway || placeDecreased) {
    await api.sendMessage(
      user.id,
      i18n.t(user.language, "speedup", {
        place: toEmoji(place),
        total: toEmoji(totalPlaces + 39),
        inviteLink: `https://t.me/${config.BOT_NAME}?start=${user.id}`,
        collectionOwner: config.COLLECTION_OWNER,
      }),
    );
    // eslint-disable-next-line no-param-reassign
    user.lastSendedPlace = place;
    await user.save();
  }
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
