import type { Context } from '#root/bot/context'
import type { BalanceChangeType } from '#root/common/models/Balance'
import type { UserDoc } from '#root/common/models/User'
import type { Row } from 'markdown-table-ts'
import { escapeMarkdown } from '#root/common/helpers/markdown'
import { kFormatter } from '#root/common/helpers/numbers'
import { formatDateTimeCompact } from '#root/common/helpers/time'
import {
  countAllBalanceRecords,
  getBalanceChangeTypeName,
  getUserBalanceRecords,
} from '#root/common/models/Balance'
import { findUserByName } from '#root/common/models/User'
import { getMarkdownTable } from 'markdown-table-ts'

export interface BalanceRecord {
  amount: bigint
  type: BalanceChangeType
  createdAt?: Date
}

export interface BalanceHandlerDependencies {
  isAdmin: (ctx: Context) => boolean
  findUserByName: (name: string) => Promise<UserDoc | null>
  countAllBalanceRecords: () => Promise<number>
  getUserBalanceRecords: (
    userId: number,
    count: number,
  ) => Promise<BalanceRecord[]>
}

export function createBalanceHandlerDependencies(
  isAdmin: (ctx: Context) => boolean,
): BalanceHandlerDependencies {
  return {
    isAdmin,
    findUserByName,
    countAllBalanceRecords,
    getUserBalanceRecords,
  }
}

export function buildBalanceCommandHandler(deps: BalanceHandlerDependencies) {
  return async function handleBalance(ctx: Context) {
    const rawMatch = typeof ctx.match === 'string' ? ctx.match : ''
    const argument = rawMatch.trim()
    let userId = ctx.dbuser.id
    let { name } = ctx.dbuser
    if (argument && deps.isAdmin(ctx)) {
      const [username] = argument.split(' ')
      const user = await deps.findUserByName(username.replace(/^@/, ''))
      if (user) {
        userId = user.id
        name = user.name
      }
    }
    const count = await deps.countAllBalanceRecords()
    const records = await deps.getUserBalanceRecords(userId, count)
    const body: Row[] = records.map((v) => [
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
    await ctx.reply(md, { parse_mode: 'Markdown' })
  }
}
