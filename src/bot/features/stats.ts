import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { userStats } from '#root/common/models/User'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

feature.command('stats', logHandle('command-stats'), async (ctx) => {
  const stats = await userStats()
  return ctx.reply(`All: ${stats.all}
With wallet: ${stats.notMinted}
NFT minted: ${stats.minted}

Active month: ${stats.month}
Active week: ${stats.week}
Active day: ${stats.day}
`)
})

export { composer as statsFeature }
