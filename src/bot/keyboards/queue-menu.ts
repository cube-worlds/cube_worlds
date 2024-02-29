/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { findQueue } from "#root/bot/models/user.js";
import { photoKeyboard } from "./photo.js";
import { getUserProfileFile } from "../helpers/photo.js";

export const queueMenu = new Menu("queue").dynamic(async (ctx, range) => {
  const queue = await findQueue();
  (ctx as Context).logger.info(queue);
  for (const item of queue) {
    range
      .text(`(${item.votes}) ${item.wallet}`, async (ctx2) => {
        const context = ctx2 as unknown as Context;
        const photo = await getUserProfileFile(context);
        if (!photo) {
          return context.reply(context.t("wrong"));
        }

        context.replyWithPhoto(photo.file_id, {
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
