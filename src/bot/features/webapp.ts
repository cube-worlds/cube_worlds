import type { Context } from '#root/bot/context.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { config } from '#root/config.js'
import { Composer, InlineKeyboard } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(['miniapp', 'webapp'], logHandle('command-webapp'), (ctx) => {
  return ctx.reply('Test webapp', {
    reply_markup: new InlineKeyboard()
      .webApp('Open Web App', config.WEB_APP_URL)
      .webApp('Claim cNFT', `${config.WEB_APP_URL}/cnft`)
      .webApp('Presentation', `${config.WEB_APP_URL}/presentation`),
  })
})

export { composer as webappFeature }
