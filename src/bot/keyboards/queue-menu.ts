/* eslint-disable no-restricted-syntax */
import { Menu } from "@grammyjs/menu";
import { Context } from "#root/bot/context.js";
import { findQueue } from "#root/bot/models/user.js";

export const queueMenu = new Menu("queue").dynamic(async (ctx, range) => {
  const queue = await findQueue();
  (ctx as Context).logger.info(queue);
  for (const item of queue) {
    range.text(item.id, (ctx2) => ctx2.reply(`${item.votes}`)).row();
  }
});
