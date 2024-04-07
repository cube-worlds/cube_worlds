import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { findTopWallets } from "#root/bot/models/user.js";
import { getMarkdownTable } from "markdown-table-ts";
import { bigIntWithCustomSeparator } from "../helpers/numbers";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

function removeMiddle(s: string, cornerLength = 5) {
  if (s.length < cornerLength * 2) {
    return s;
  }
  const first = s.slice(0, cornerLength);
  const last = s.slice(-cornerLength);
  return `${first}...${last}`;
}

feature.command("whales", logHandle("command-reset"), async (ctx) => {
  const queue = await findTopWallets(25);
  const md = `\`\`\`\n${getMarkdownTable({
    table: {
      head: ["User", "$CUBE"],
      body: queue.map((v) => [
        removeMiddle(v.wallet ?? "undefined"),
        bigIntWithCustomSeparator(v.votes),
      ]),
    },
  })}\n\`\`\``;
  ctx.replyWithMarkdown(md);
});

export { composer as whalesFeature };
