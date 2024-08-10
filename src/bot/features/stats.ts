import { Composer } from "grammy"
import type { Context } from "#root/bot/context.js"
import { logHandle } from "#root/bot/helpers/logging.js"
import { isAdmin } from "#root/bot/filters/is-admin.js"
import { userStats } from "../models/user"

const composer = new Composer<Context>()

const feature = composer.chatType("private").filter(isAdmin)

feature.command("stats", logHandle("command-stats"), async ctx => {
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
