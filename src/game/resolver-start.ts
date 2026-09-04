import type { Api } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { getPool, setPool } from '#root/common/models/PlaceState'
import { addPoints, bumpRep, findUsersByIds } from '#root/common/models/User'
import { findUnresolvedVisits, findWindowsToResolve, resolveVisitOnce } from '#root/common/models/Visit'
import { claimWindow, markWindowResolved } from '#root/common/models/Window'
import { config } from '#root/config'
import { PLACES } from '#root/game/places'
import { buildResolver } from '#root/game/resolver'
import { logger } from '#root/logger'

const TICK_MS = 60 * 1000

export function baliDeepLink(place: string): string {
  return `https://t.me/${config.BOT_NAME}?startapp=bali_${place}`
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
