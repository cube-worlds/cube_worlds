import type { Context } from '#root/bot/context'
import type { Row } from 'markdown-table-ts'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { escapeMarkdown } from '#root/common/helpers/markdown'
import { kFormatter } from '#root/common/helpers/numbers'
import { formatDateTimeCompact } from '#root/common/helpers/time'
import {
    countAllBalanceRecords,
    getBalanceChangeTypeName,
    getUserBalanceRecords,
} from '#root/common/models/Balance'
import { findUserByName } from '#root/common/models/User'
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
    await ctx.reply(md, { parse_mode: 'Markdown' })
})

export { composer as balanceFeature }
