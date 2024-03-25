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
import { logger } from "#root/logger";
import { i18n } from "../i18n";

export function photoCaption(user: User) {
  return `@[${user.name}](tg://user?id=${user.id})

Comment: \`${`${user.description?.slice(0, user.nftDescription ? 100 : 700) ?? ""}${user.nftDescription ? "..." : ""}`}\`

Description: \`${user.nftDescription ?? ""}\`
${user.nftImage ? `[Image](https://ipfs.io/ipfs/${user.nftImage}) | ` : ""} ${user.nftJson ? `[JSON](https://ipfs.io/ipfs/${user.nftJson})` : ""}

Minted: ${user.minted ? "✅" : "❌"} ${user.nftUrl ? `[NFT](${user.nftUrl})` : ""}
`;
}

export async function sendUserMetadata(
  context: Context,
  selectedUser: DocumentType<User>,
) {
  context.chatAction = "upload_document";

  const adminUser = context.dbuser;
  adminUser.avatarNumber =
    adminUser.selectedUser === selectedUser.id
      ? (adminUser.avatarNumber ?? -1) + 1
      : 0;
  adminUser.selectedUser = selectedUser.id;
  await adminUser.save();

  try {
    const randomAva = await getUserProfileFile(
      context,
      selectedUser.id ?? 0,
      adminUser.avatarNumber ?? 0,
    );
    if (!randomAva) {
      return context.reply(context.t("wrong"));
    }
    const index = await NftCollection.fetchNextItemIndex();
    const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${randomAva.file_path}`;
    // eslint-disable-next-line no-param-reassign
    selectedUser.avatar = await saveImageFromUrl(photoUrl, index, true);
    await selectedUser.save();

    context.replyWithPhoto(randomAva.file_id, {
      caption: photoCaption(selectedUser),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: photoKeyboard,
      },
    });
  } catch (error) {
    if ((error as Error).message === "Zero count photos") {
      // eslint-disable-next-line no-param-reassign
      selectedUser.state = UserState.WaitNothing;
      await selectedUser.save();
      const message = `❌ ${i18n.t(selectedUser.language, "no_photo_after_submit")}`;
      await context.api.sendMessage(selectedUser.id, message);
      await context.api.sendMessage(adminUser.id, message);
    } else {
      logger.error(error);
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
