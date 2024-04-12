import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import {
  countAllWallets,
  findLine,
  placeInLine,
} from "#root/bot/models/user.js";
import { getMarkdownTable } from "markdown-table-ts";
import { bigIntWithCustomSeparator } from "../helpers/numbers";
import { removeMiddle } from "../helpers/text";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("line", logHandle("command-line"), async (ctx) => {
  const count = await countAllWallets();
  const line = await findLine(50);
  const body = line.map((v, index) => [
    String(index + 1),
    removeMiddle(v.wallet ?? "undefined"),
    bigIntWithCustomSeparator(v.votes),
  ]);
  if (!line.some((v) => v.wallet === ctx.dbuser.wallet)) {
    const place = await placeInLine(ctx.dbuser.votes);
    if (place) {
      body.push(
        ["...", "...", "..."],
        [
          String(place),
          removeMiddle(ctx.dbuser.wallet ?? "undefined"),
          bigIntWithCustomSeparator(ctx.dbuser.votes),
        ],
      );
    }
  }
  const md = `${ctx.t("line.count", { count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ["Number", "Wallet", "$CUBE"],
      body,
    },
  })}\n\`\`\``;
  await ctx.replyWithMarkdown(md);
});

export { composer as lineFeature };
