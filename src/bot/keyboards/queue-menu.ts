/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { findQueue } from "#root/bot/models/user.js";
import { photoKeyboard } from "./photo.js";

export const queueMenu = new Menu("queue").dynamic(async (ctx, range) => {
  const queue = await findQueue();
  (ctx as Context).logger.info(queue);
  for (const item of queue) {
    range
      .text(`(${item.votes}) ${item.wallet}`, (ctx2) => {
        const photourl = "https://i.imgur.com/rMQMaTm.png";
        ctx2.replyWithPhoto(photourl, {
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
