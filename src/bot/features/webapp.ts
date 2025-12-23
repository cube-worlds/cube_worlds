import type { Context } from '#root/bot/context'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { Composer, InlineKeyboard } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(['miniapp', 'webapp'], logHandle('command-webapp'), (ctx) => {
  return ctx.reply('Test webapp', {
    reply_markup: new InlineKeyboard()
      .webApp('Open Web App', config.WEB_APP_URL)
      .webApp('Claim cNFT', `${config.WEB_APP_URL}/cnft`)
      .webApp('Mining', `${config.WEB_APP_URL}/mining`),
    parse_mode: 'HTML',
  })
})

export { composer as webappFeature }
