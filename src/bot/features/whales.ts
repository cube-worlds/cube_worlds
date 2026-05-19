import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { getMarkdownTable } from 'markdown-table-ts'
import { appendOwnRowIfMissing } from '#root/common/helpers/leaderboard-rows'
import { logHandle } from '#root/common/helpers/logging'
import { commaSeparatedNumber } from '#root/common/helpers/numbers'
import { removeMiddle } from '#root/common/helpers/text'
import {
  countAllBalances,
  countAllWallets,
  findWhales,
  placeInWhales,
} from '#root/common/models/User'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('whales', logHandle('command-line'), async (ctx) => {
  const points = commaSeparatedNumber(await countAllBalances())
  const count = await countAllWallets()
  const whales = await findWhales(50)
  const initialBody = whales.map((v, index) => [
    String(index + 1),
    removeMiddle(v.wallet ?? 'undefined'),
    commaSeparatedNumber(v.votes),
  ])
  const body = await appendOwnRowIfMissing({
    body: initialBody,
    topN: whales,
    ownMatches: (v) => v.wallet === ctx.dbuser.wallet,
    buildOwnRow: async () => {
      const place = await placeInWhales(ctx.dbuser.votes)
      return [
        String(place),
        removeMiddle(ctx.dbuser.wallet ?? 'undefined'),
        commaSeparatedNumber(ctx.dbuser.votes),
      ]
    },
  })
  const md = `${ctx.t('whales.count', { points, count })}
\`\`\`\n${getMarkdownTable({
    table: {
      head: ['Number', 'Wallet', '$CUBE'],
      body,
    },
  })}\n\`\`\``
  await ctx.reply(md, { parse_mode: 'Markdown' })
})

export { composer as whalesFeature }
