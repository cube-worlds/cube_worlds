import type { Context } from '#root/bot/context.js'
import type { InlineKeyboardButton } from '@grammyjs/types'
import { logHandle } from '#root/bot/helpers/logging.js'
import { config } from '#root/config'
import { logger } from '#root/logger'
import { ChatGPTAPI } from 'chatgpt'
import { Composer, InlineKeyboard } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

async function play(ctx: Context) {
  const prompt = `Let's play a game. I am the sole protagonist of this story. You are the narrator of this story. This story is written by mixing different genres (fantasy, horror, science fiction, comedy, romance, adventure) cleverly blended together, creating suspense and twists. The story is divided into paragraphs. Each paragraph is around 75 words and is a second-person description of the story. At the end of every paragraph ask me what I want to do and give me a set of options. When a paragraph ends give me options on what to say or do based on my current situation. Whenever you give me options on what I want to do include 3 to 6 different option suggestions and an extra option for "other action." Wait for the user to select which option they choose. Continue the story based on the user's response. Write another paragraph of the story based on the response. In this game where you are the narrator, always use the following Rules: Only continue the story after the user has chosen an option or responded with what they will do. Do not rush the story, the pace will be very slow. Do not be general in your descriptions. Try to be detailed. Do not continue the story without the protagonist's input. Continue the new paragraph with a 75-word description of the story. The story must not end. Start the story with the first paragraph by describing a grand introduction to my party and a description of the surrounding environment. You MUST return result as json with following format like:
{
  "story": "text of the story",
  "options": ["option1", "option2", "option3", "option4", "option5", "option6"]
}
Result MUST be without any syntax hightlights. 
Result MUST be in ${ctx.dbuser.language} language.`
  const chatGPT = new ChatGPTAPI({
    apiKey: config.OPENAI_API_KEY,
    completionParams: {
      max_tokens: 512,
    },
  })
  const result = await chatGPT.sendMessage(prompt)
  const json = JSON.parse(result.text) as { story: string, options: string[] }
  logger.info(json)
  const keyboard = new InlineKeyboard()
  const buttons: InlineKeyboardButton[] = json.options.map((option, index) => {
    return {
      text: option,
      callback_data: `play:${index}`,
    }
  })

  for (const button of buttons) {
    keyboard.row(button as InlineKeyboardButton)
  }
  // TODO: save chat and convesationId to db
  await ctx.reply(json.story, { reply_markup: keyboard })
}

feature.command('play', logHandle('command-play'), async (ctx) => {
  if (config.BOT_ADMINS.includes(ctx.from.id)) {
    await play(ctx)
    return
  }
  await (ctx.dbuser.minted
    ? ctx.reply(ctx.t('play.minted'), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ctx.t('play.clicker'),
                url: `https://t.me/${config.BOT_NAME}/clicker`,
              },
            ],
          ],
        },
      })
    : ctx.reply(ctx.t('play.not_minted')))
})

export { composer as playFeature }
