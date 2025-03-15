import type { Context } from '#root/bot/context.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import {
  countAllBalances,
  countAllWallets,
  findWhales,
  placeInWhales,
} from '#root/bot/models/user.js'
import { Composer } from 'grammy'
import { getMarkdownTable } from 'markdown-table-ts'
import { bigIntWithCustomSeparator } from '../helpers/numbers'
import { removeMiddle } from '../helpers/text'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('whales', logHandle('command-line'), async (ctx) => {
  const points = bigIntWithCustomSeparator(BigInt(await countAllBalances()))
  const count = await countAllWallets()
  const whales = await findWhales(50)
  const body = whales.map((v, index) => [
    String(index + 1),
    removeMiddle(v.wallet ?? 'undefined'),
    bigIntWithCustomSeparator(v.votes),
  ])
  if (!whales.some(v => v.wallet === ctx.dbuser.wallet)) {
    const place = await placeInWhales(ctx.dbuser.votes)
    body.push(
      ['...', '...', '...'],
      [
        String(place),
        removeMiddle(ctx.dbuser.wallet ?? 'undefined'),
        bigIntWithCustomSeparator(ctx.dbuser.votes),
      ],
    )
  }
  const md = `${ctx.t('whales.count', { points, count })}
\`\`\`\n${getMarkdownTable({
  table: {
    head: ['Number', 'Wallet', '$CUBE'],
    body,
  },
})}\n\`\`\``
  await ctx.replyWithMarkdown(md)
})

export { composer as whalesFeature }
