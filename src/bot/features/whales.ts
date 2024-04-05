import { Composer } from "grammy";
import type { Context } from "#root/bot/context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { findAll } from "#root/bot/models/user.js";
import { getMarkdownTable } from "markdown-table-ts";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

function removeMiddle(s: string) {
  if (s.length < 5) {
    return s;
  }
  const first = s.slice(0, 2);
  const last = s.slice(-2);
  return `${first}..${last}`;
}

feature.command("whales", logHandle("command-reset"), async (ctx) => {
  const queue = await findAll(25);
  const md = `\`\`\`\n${getMarkdownTable({
    table: {
      head: ["User", "$CUBE"],
      body: queue.map((v) => [
        String(removeMiddle(v.name ?? v.id)),
        String(v.votes),
      ]),
    },
  })}\n\`\`\``;
  ctx.replyWithMarkdown(md);
});

export { composer as whalesFeature };
