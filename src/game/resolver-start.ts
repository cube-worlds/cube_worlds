import type { Api } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { getPool, setPool } from '#root/common/models/PlaceState'
import { addPoints, bumpRep, findUsersByIds } from '#root/common/models/User'
import { findUnresolvedVisits, findWindowsToResolve, resolveVisitOnce } from '#root/common/models/Visit'
import { claimWindow, markWindowResolved, setWindowRecap } from '#root/common/models/Window'
import { config } from '#root/config'
import { renderGazetteText } from '#root/game/gazette'
import { PLACES } from '#root/game/places'
import { buildResolver } from '#root/game/resolver'
import { logger } from '#root/logger'

const TICK_MS = 60 * 1000

export function baliDeepLink(place: string): string {
  return `https://t.me/${config.BOT_NAME}?startapp=bali_${place}`
}

export function passDeepLink(index: number): string {
  return `https://t.me/${config.BOT_NAME}?startapp=pass_${index}`
}

export function createResolver(api: Api) {
  return buildResolver({
    now: () => Date.now(),
    places: PLACES,
    claimWindow,
    markWindowResolved,
    findWindowsToResolve,
    findUnresolvedVisits,
    resolveVisitOnce,
    addPoints,
    bumpRep,
    getPool,
    setPool,
    holdersOf: async (ids) => {
      const users = await findUsersByIds(ids)
      return new Map(users.map(u => [u.id, { traits: u.pass?.traits, pass: u.pass ? { index: u.pass.index, name: u.pass.name } : undefined }]))
    },
    notify: async (userId, text, place) => {
      await api.sendMessage(userId, `🌴 ${text}`, {
        reply_markup: new InlineKeyboard().url('Open Bali', baliDeepLink(place)),
      })
    },
    publishGazette: async (gazette) => {
      await setWindowRecap(gazette.windowId, gazette)
      const text = renderGazetteText(gazette, passDeepLink)
      const busiest = gazette.places[0]?.place ?? 'canggu'
      for (const chatId of config.COMMUNITY_CHAT_IDS) {
        try {
          await api.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: new InlineKeyboard().url('Open Bali', baliDeepLink(busiest)),
          })
        } catch (err) {
          logger.error(`Bali gazette post to chat ${chatId} failed: ${(err as Error).message}`)
        }
      }
    },
    rng: Math.random,
    logError: message => logger.error(message),
  })
}

export function startResolver(api: Api) {
  const resolver = createResolver(api)
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await resolver.tick()
    } catch (err) {
      logger.error(`Bali resolver tick failed: ${(err as Error).message}`)
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => void tick(), TICK_MS)
  void tick()
  return { tick, stop: () => clearInterval(timer) }
}
