import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import {
  countAllBalances,
  countAllWallets,
  findTopWallets,
  placeInLine,
} from "#root/bot/models/user.js";
import { getMarkdownTable } from "markdown-table-ts";
import { bigIntWithCustomSeparator } from "../helpers/numbers";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

function removeMiddle(s: string, cornerLength = 4) {
  if (s.length < cornerLength * 2) {
    return s;
  }
  const first = s.slice(0, cornerLength);
  const last = s.slice(-cornerLength);
  return `${first}...${last}`;
}

feature.command("whales", logHandle("command-reset"), async (ctx) => {
  const points = bigIntWithCustomSeparator(BigInt(await countAllBalances()));
  const count = await countAllWallets();
  const topWallets = await findTopWallets(30);
  const body = topWallets.map((v, index) => [
    String(index + 1),
    removeMiddle(v.wallet ?? "undefined"),
    bigIntWithCustomSeparator(v.votes),
    v.minted ? " ✓" : "",
  ]);
  if (!topWallets.some((v) => v.wallet === ctx.dbuser.wallet)) {
    const place = await placeInLine(ctx.dbuser.votes);
    body.push(
      ["...", "...", "...", "..."],
      [
        String(place),
        removeMiddle(ctx.dbuser.wallet ?? "undefined"),
        bigIntWithCustomSeparator(ctx.dbuser.votes),
        ctx.dbuser.minted ? " ✓" : "",
      ],
    );
  }
  const md = `${ctx.t("whales.count", { points, count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ["N", "Wallet", "$CUBE", "NFT"],
      body,
    },
  })}\n\`\`\``;
  await ctx.replyWithMarkdown(md);
});

export { composer as whalesFeature };
