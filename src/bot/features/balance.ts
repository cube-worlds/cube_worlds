import type { Context } from '#root/bot/context.js'
import type { Row } from 'markdown-table-ts'
import { isAdmin } from '#root/bot/filters/is-admin.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { escapeMarkdown } from '#root/bot/helpers/markdown.js'
import { kFormatter } from '#root/bot/helpers/numbers.js'
import { formatDateTimeCompact } from '#root/bot/helpers/time.js'
import {
  countAllBalanceRecords,
  getBalanceChangeTypeName,
  getUserBalanceRecords,
} from '#root/bot/models/balance.js'
import { findUserByName } from '#root/bot/models/user.js'
import { Composer } from 'grammy'
import { getMarkdownTable } from 'markdown-table-ts'

const composer = new Composer<Context>()
const feature = composer.chatType('private')

feature.command('balance', logHandle('command-balance'), async (ctx) => {
  const argument = ctx.match.trim()
  let userId = ctx.dbuser.id
  let { name } = ctx.dbuser
  if (argument && isAdmin(ctx)) {
    const [username] = argument.split(' ')
    const user = await findUserByName(username.replace(/^@/, ''))
    if (user) {
      userId = user.id
      name = user.name
    }
  }
  const count = await countAllBalanceRecords()
  const records = await getUserBalanceRecords(userId, count)
  const body: Row[] = records.map(v => [
    kFormatter(v.amount),
    getBalanceChangeTypeName(v.type),
    v.createdAt ? formatDateTimeCompact(v.createdAt) : '',
  ])
  const md = `${name ? `@${escapeMarkdown(name)}'s balance` : ''}
\`\`\`\n${getMarkdownTable({
  table: {
    head: ['$CUBE', 'Type', 'Date'],
    body,
  },
})}\n\`\`\``
  await ctx.replyWithMarkdown(md)
})

export { composer as balanceFeature }
