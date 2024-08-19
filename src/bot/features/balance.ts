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
import { findUserByName } from "#root/bot/models/user.js"
import { isAdmin } from "#root/bot/filters/is-admin.js"

const composer = new Composer<Context>()
const feature = composer.chatType("private")

feature.command("balance", logHandle("command-balance"), async ctx => {
  const argument = ctx.match.trim()
  let userId = ctx.dbuser.id
  if (argument && isAdmin(ctx.dbuser.id)) {
    const [username] = argument.split(" ")
    const user = await findUserByName(username.replace(/^@/, ""))
    if (user) {
      userId = user.id
    }
  }
  const count = await countAllBalanceRecords()
  const records = await getUserBalanceRecords(userId, count)
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
