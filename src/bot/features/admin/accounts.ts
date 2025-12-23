import type { Context } from '#root/bot/context'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { config } from '#root/config'
import { Composer } from 'grammy'
import fetch from 'node-fetch'

const composer = new Composer<Context>()

const feature = composer.chatType('private').filter(isAdmin)

async function getStabilityBalance(): Promise<number> {
  const apiHost = 'https://api.stability.ai'
  const url = `${apiHost}/v1/user/balance`
  const apiKey = config.STABILITY_API_KEY
  if (!apiKey) throw new Error('Missing Stability API key.')
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Non-200 response: ${await response.text()}`)
  }
  interface Balance {
    credits: number
  }
  const balance = (await response.json()) as Balance
  return balance.credits
}

feature.command('accounts', logHandle('command-accounts'), async (ctx) => {
  const stabilityBalance = await getStabilityBalance()
  return ctx.reply(
    `Stability balance: ${stabilityBalance} credits
OpenAI balance can be found in the [OpenAI dashboard](https://platform.openai.com/settings/organization/billing/overview)`,
    {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    },
  )
})

export { composer as accountsFeature }
