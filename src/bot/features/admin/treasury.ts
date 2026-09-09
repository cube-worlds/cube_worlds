import type { Context } from '#root/bot/context'
import { Composer } from 'grammy'
import { isAdmin } from '#root/bot/filters/is-admin'
import { logHandle } from '#root/common/helpers/logging'
import { addToPool, getPools } from '#root/common/models/PlaceState'
import { PLACES } from '#root/game/places'
import { buildTreasuryHandler } from './treasury-handler'

const composer = new Composer<Context>()
const feature = composer.chatType('private').filter(isAdmin)

const treasury = buildTreasuryHandler({ places: PLACES, getPools, addToPool })

feature.command('treasury', logHandle('command-treasury'), async ctx =>
  ctx.reply(await treasury(ctx.match), { parse_mode: 'HTML' }))

export { composer as treasuryFeature }
