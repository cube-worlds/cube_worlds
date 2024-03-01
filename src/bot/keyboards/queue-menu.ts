/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { findQueue } from "#root/bot/models/user.js";
import { config } from "#root/config.js";
import { photoKeyboard } from "./photo.js";
import { getUserProfileFile } from "../helpers/photo.js";
import { saveImageFromUrl } from "../helpers/files.js";
import { NftCollection } from "../models/nft-collection.js";

export const queueMenu = new Menu("queue").dynamic(async (_, range) => {
  const queue = await findQueue();
  for (const item of queue) {
    range
      .text(`(${item.votes}) ${item.wallet}`, async (ctx) => {
        const context = ctx as unknown as Context;
        context.chatAction = "upload_document";

        const randomAva = await getUserProfileFile(context);
        if (!randomAva) {
          return context.reply(context.t("wrong"));
        }

        const index = await NftCollection.fetchNextItemIndex();
        const photoUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${randomAva.file_path}`;
        const avaPath = await saveImageFromUrl(photoUrl, index, true);
        item.avatar = avaPath;
        item.save();

        context.replyWithPhoto(randomAva.file_id, {
          caption: `[${item.name}](tg://user?id=${item.id})\n\n${item.description}`,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: photoKeyboard,
          },
        });
      })
      .row();
  }
});
