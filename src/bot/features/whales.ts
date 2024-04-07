import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { countAllWallets, findTopWallets } from "#root/bot/models/user.js";
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
  const count = await countAllWallets();
  const topWallets = await findTopWallets(30);
  const md = `${ctx.t("whales.count", { count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ["User", "$CUBE"],
      body: topWallets.map((v) => [
        removeMiddle(v.wallet ?? "undefined"),
        bigIntWithCustomSeparator(v.votes),
      ]),
    },
  })}\n\`\`\``;
  ctx.replyWithMarkdown(md);
});

export { composer as whalesFeature };
