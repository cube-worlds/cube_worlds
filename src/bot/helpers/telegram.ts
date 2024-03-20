import { config } from "#root/config";
import { Api, RawApi } from "grammy";
import { DocumentType } from "@typegoose/typegoose";
import { User, findQueue, placeInLine } from "../models/user";
import { i18n } from "../i18n";
import { sleep } from "./ton";

export async function sendPlaceInLine(
  api: Api<RawApi>,
  user: DocumentType<User>,
  sendAnyway = true,
) {
  const place = await placeInLine(user.votes);
  const lastSendedPlace = user.lastSendedPlace ?? Number.MAX_SAFE_INTEGER;
  const placeDecreased = place < lastSendedPlace;
  if (sendAnyway || placeDecreased) {
    await api.sendMessage(
      user.id,
      i18n.t(user.language, "speedup", {
        place,
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
    // eslint-disable-next-line no-await-in-loop
    await sendPlaceInLine(api, user, false);
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }
}
