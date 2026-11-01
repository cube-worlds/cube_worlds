import type { Api } from 'grammy'
import { randomBytes } from 'node:crypto'
import { InlineKeyboard } from 'grammy'
import { getPools } from '#root/common/models/PlaceState'
import {
  addPoints,
  debitVotes,
  findUserById,
  findUserByPassIndex,
  setPassTraits,
} from '#root/common/models/User'
import {
  bindInvite,
  countVisitsByPlace,
  createVisit,
  findResolvedVisits,
  findVisit,
  incChallenges,
  lastResolvedVisit,
  setPartner,
} from '#root/common/models/Visit'
import { findLatestRecap } from '#root/common/models/Window'
import { config } from '#root/config'
import { PLACES } from '#root/game/places'
import { passDeepLink } from '#root/game/resolver-start'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { loadTraitsForPassAddress } from './pass'
import { buildWorldHandler } from './world-handler'

export function createWorldHandler(api: Api) {
  return buildWorldHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    findUserByPassIndex,
    now: () => Date.now(),
    places: PLACES,
    countVisitsByPlace,
    getPools,
    findVisit,
    lastResolvedVisit,
    findResolvedVisits,
    findLatestRecap,
    debitVotes,
    addPoints,
    createVisit,
    bindInvite,
    setPartner,
    incChallenges,
    sendChallenge: async (targetId, c) => {
      const until = `${String(new Date(c.endsAt).getUTCHours()).padStart(2, '0')}:00 UTC`
      await api.sendMessage(targetId, `🌴 ${c.hostName} (pass #${c.hostIndex}) challenges you at Canggu — help or steal? Until ${until}.`, {
        reply_markup: new InlineKeyboard()
          .url('Accept', `https://t.me/${config.BOT_NAME}?startapp=meet_${c.inviteCode}`)
          .row()
          .url('Their pass', passDeepLink(c.hostIndex)),
      })
    },
    loadTraitsForPass: loadTraitsForPassAddress,
    setPassTraits,
    randomCode: () => randomBytes(6).toString('base64url'),
    logError: message => logger.error(message),
  })
}
