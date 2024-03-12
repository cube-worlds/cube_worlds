/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { User, findQueue } from "#root/bot/models/user.js";
import { config } from "#root/config.js";
import { getUserProfileFile } from "#root/bot/helpers/photo.js";
import { saveImageFromUrl } from "#root/bot/helpers/files.js";
import { NftCollection } from "#root/bot/models/nft-collection.js";
import { DocumentType } from "@typegoose/typegoose";
import { photoKeyboard } from "#root/bot/keyboards/photo.js";

export function photoCaption(user: User) {
  return `[${user.name}](tg://user?id=${user.id})

Comment: \`${user.description?.slice(0, 1000) ?? ""}\`

Description: \`${user.nftDescription ?? ""}\`

Image: ${user.nftImage ? `[ipfs](https://ipfs.io/ipfs/${user.nftImage})` : ""}

JSON: ${user.nftJson ? `[ipfs](https://ipfs.io/ipfs/${user.nftJson})` : ""}
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
}

export const queueMenu = new Menu("queue").dynamic(async (_, range) => {
  const users = await findQueue();
  for (const user of users) {
    range
      .text(`(${user.votes}) ${user.wallet}`, async (ctx) => {
        const context = ctx as unknown as Context;
        sendUserMetadata(context, user);
      })
      .row();
  }
});
