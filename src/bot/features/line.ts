import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { getMarkdownTable } from 'markdown-table-ts'
import { isAdmin } from '#root/bot/filters/is-admin'
import { appendOwnRowIfMissing } from '#root/common/helpers/leaderboard-rows'
import { logHandle } from '#root/common/helpers/logging'
import { commaSeparatedNumber } from '#root/common/helpers/numbers'
import { removeMiddle } from '#root/common/helpers/text'
import {
  countAllLine,
  findLine,
  placeInLine,
  UserState,
} from '#root/common/models/User'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('line', logHandle('command-line'), async (ctx) => {
  const count = await countAllLine()
  const line = await findLine(10)
  const initialBody = line.map((v, index) => [
    String(index + 1) + (v.diceWinner ? ' (dice)' : ''),
    removeMiddle(v.name ?? 'undefined', 6),
    commaSeparatedNumber(v.votes),
  ])
  const shouldAppendOwn
    = !ctx.dbuser.minted && ctx.dbuser.state === UserState.Submited
  const body = shouldAppendOwn
    ? await appendOwnRowIfMissing({
        body: initialBody,
        topN: line,
        ownMatches: (v) => v.name === ctx.dbuser.name,
        buildOwnRow: async () => {
          const place = await placeInLine(ctx.dbuser.votes)
          if (!place) return null
          return [
            String(place),
            removeMiddle(ctx.dbuser.name ?? 'undefined', 6),
            commaSeparatedNumber(ctx.dbuser.votes),
          ]
        },
      })
    : initialBody
  const md = `${ctx.t('line.count', { count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ['Number', 'Username', '$CUBE'],
      body,
    },
  })}\n\`\`\``
  await ctx.reply(md, { parse_mode: 'Markdown' })
})

export { composer as lineFeature }
