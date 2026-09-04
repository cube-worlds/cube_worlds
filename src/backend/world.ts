import { randomBytes } from 'node:crypto'
import { getPool } from '#root/common/models/PlaceState'
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
  lastResolvedVisit,
  setPartner,
} from '#root/common/models/Visit'
import { PLACES } from '#root/game/places'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { loadTraitsForPassAddress } from './pass'
import { buildWorldHandler } from './world-handler'

export function createWorldHandler() {
  return buildWorldHandler({
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUser: findUserById,
    findUserByPassIndex,
    now: () => Date.now(),
    places: PLACES,
    countVisitsByPlace,
    getPool,
    findVisit,
    lastResolvedVisit,
    findResolvedVisits,
    debitVotes,
    addPoints,
    createVisit,
    bindInvite,
    setPartner,
    loadTraitsForPass: loadTraitsForPassAddress,
    setPassTraits,
    randomCode: () => randomBytes(6).toString('base64url'),
    logError: message => logger.error(message),
  })
}
