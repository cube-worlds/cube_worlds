import { Composer } from "grammy"
import { getMarkdownTable, Row } from "markdown-table-ts"
import type { Context } from "#root/bot/context.js"
import { logHandle } from "#root/bot/helpers/logging.js"
import { kFormatter } from "#root/bot/helpers/numbers.js"
import {
  countAllBalanceRecords,
  getBalanceChangeTypeName,
  getUserBalanceRecords,
} from "#root/bot/models/balance.js"
import { formatDateTimeCompact } from "#root/bot/helpers/time.js"

const composer = new Composer<Context>()
const feature = composer.chatType("private")

feature.command("balance", logHandle("command-balance"), async ctx => {
  const count = await countAllBalanceRecords()
  const records = await getUserBalanceRecords(ctx.dbuser.id, count)
  const body: Row[] = records.map(v => [
    kFormatter(v.amount),
    getBalanceChangeTypeName(v.type),
    v.createdAt ? formatDateTimeCompact(v.createdAt) : "",
  ])
  const md = `
\`\`\`\n${getMarkdownTable({
    table: {
      head: ["$CUBE", "Type", "Date"],
      body,
    },
  })}\n\`\`\``
  await ctx.replyWithMarkdown(md)
})

export { composer as balanceFeature }
