/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { User, UserState, findQueue } from "#root/bot/models/user.js";
import { config } from "#root/config.js";
import { getUserProfileFile } from "#root/bot/helpers/photo.js";
import { saveImageFromUrl } from "#root/bot/helpers/files.js";
import { NftCollection } from "#root/bot/models/nft-collection.js";
import { DocumentType } from "@typegoose/typegoose";
import { photoKeyboard } from "#root/bot/keyboards/photo.js";
import { i18n } from "../i18n";

export function photoCaption(user: User) {
  return `[${user.name}](tg://user?id=${user.id})
Comment: \`${`${user.description?.slice(0, user.nftDescription ? 100 : 700) ?? ""}${user.nftDescription ? "..." : ""}`}\`
Description: \`${user.nftDescription ?? ""}\`
${user.nftImage ? `[Image](https://ipfs.io/ipfs/${user.nftImage}) | ` : ""} ${user.nftJson ? `[JSON](https://ipfs.io/ipfs/${user.nftJson})` : ""}
Minted: ${user.minted ? "✅" : "❌"} ${user.nftUrl ? `[NFT](${user.nftUrl})` : ""}
`;
}

export async function sendUserMetadata(
  context: Context,
  user: DocumentType<User>,
) {
  context.chatAction = "upload_document";

  const currentUser = context.dbuser;
  currentUser.selectedUser = user.id;
  await currentUser.save();

  try {
    const randomAva = await getUserProfileFile(context, user.id ?? 0);
    if (!randomAva) {
      return context.reply(context.t("wrong"));
    }
    const index = await NftCollection.fetchNextItemIndex();
    const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${randomAva.file_path}`;
    // eslint-disable-next-line no-param-reassign
    user.avatar = await saveImageFromUrl(photoUrl, index, true);
    await user.save();

    context.replyWithPhoto(randomAva.file_id, {
      caption: photoCaption(user),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: photoKeyboard,
      },
    });
  } catch (error) {
    if ((error as Error).message === "Zero count photos") {
      context.api.sendMessage(
        currentUser.id,
        i18n.t(currentUser.language, "no_photo_after_submit"),
      );
      currentUser.state = UserState.WaitNothing;
      currentUser.save();
    } else {
      return context.reply(context.t("wrong"));
    }
  }
}

export const queueMenu = new Menu("queue").dynamic(async (_, range) => {
  const users = await findQueue();
  for (const user of users) {
    range
      .text(`(${user.votes}) ${user.name ?? user.wallet}`, async (ctx) => {
        const context = ctx as unknown as Context;
        sendUserMetadata(context, user);
      })
      .row();
  }
});
