import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import {
  UserState,
  countAllLine,
  findLine,
  placeInLine,
} from "#root/bot/models/user.js";
import { getMarkdownTable } from "markdown-table-ts";
import { bigIntWithCustomSeparator } from "../helpers/numbers";
import { removeMiddle } from "../helpers/text";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("line", logHandle("command-line"), async (ctx) => {
  const count = await countAllLine();
  const line = await findLine(10);
  const body = line.map((v, index) => [
    String(index + 1) + (v.diceWinner ? " (dice)" : ""),
    removeMiddle(v.name ?? "undefined", 6),
    bigIntWithCustomSeparator(v.votes),
  ]);
  if (
    !ctx.dbuser.minted &&
    ctx.dbuser.state === UserState.Submited &&
    !line.some((v) => v.name === ctx.dbuser.name)
  ) {
    const place = await placeInLine(ctx.dbuser.votes);
    if (place) {
      body.push(
        ["...", "...", "..."],
        [
          String(place),
          removeMiddle(ctx.dbuser.name ?? "undefined", 6),
          bigIntWithCustomSeparator(ctx.dbuser.votes),
        ],
      );
    }
  }
  const md = `${ctx.t("line.count", { count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ["Number", "Username", "$CUBE"],
      body,
    },
  })}\n\`\`\``;
  await ctx.replyWithMarkdown(md);
});

export { composer as lineFeature };
