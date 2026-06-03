import type { InitData } from '@telegram-apps/init-data-node'
import type { DocumentType } from '@typegoose/typegoose'
import type { FastifyInstance } from 'fastify'
import type { EquipResult } from '#root/common/models/Equipment'
import type { Hero } from '#root/common/models/Hero'
import { ClientError } from '#root/common/errors'
import { equipItem, findEquipmentByUser, unequipItem } from '#root/common/models/Equipment'
import { findHeroForUser } from '#root/common/models/Hero'
import { findUserById } from '#root/common/models/User'
import { logger } from '#root/logger'
import { defaultParseInitData, defaultValidateInitData } from './init-data'
import { safeErrorResponse } from './safe-error'

interface Body { initData: string, equipmentId?: string, heroId?: string }

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>
type HeroRef = Pick<DocumentType<Hero>, '_id'>
interface EquipmentRow { _id: unknown, slot: string, rarity: string, bonusHp: number, bonusAtk: number, bonusDef: number, equippedHeroId?: string | null, nftMinted: boolean }

export interface EquipmentHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  findHeroForUser: (userId: number, heroId: string) => Promise<HeroRef | null>
  findEquipmentByUser: (userId: number) => Promise<EquipmentRow[]>
  equipItem: (userId: number, equipmentId: string, heroId: string) => Promise<EquipResult>
  unequipItem: (userId: number, equipmentId: string) => Promise<boolean>
  logError: (message: string) => void
}

function createDefaultDependencies(): EquipmentHandlerDependencies {
  return {
    validateInitData: defaultValidateInitData,
    parseInitData: defaultParseInitData,
    findUserById,
    findHeroForUser: (userId, heroId) => findHeroForUser(userId, heroId) as never,
    findEquipmentByUser: userId => findEquipmentByUser(userId) as never,
    equipItem,
    unequipItem,
    logError: logger.error.bind(logger),
  }
}

async function findUserByInitData(initData: string, deps: EquipmentHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId) throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user) throw new ClientError('User not found in database')
  return user
}

const listSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true } as const
const equipSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, equipmentId: { type: 'string', maxLength: 64 }, heroId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const
const unequipSchema = { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 }, equipmentId: { type: 'string', maxLength: 64 } } } }, attachValidation: true } as const

function itemView(e: EquipmentRow) {
  return { id: String(e._id), slot: e.slot, rarity: e.rarity, bonus: { hp: e.bonusHp, atk: e.bonusAtk, def: e.bonusDef }, equippedHeroId: e.equippedHeroId ?? null, nftMinted: e.nftMinted }
}

const EQUIP_ERROR: Record<Exclude<EquipResult, 'ok'>, string> = {
  'slot-occupied': 'That slot is already filled on this hero',
  'not-available': 'Item not available to equip',
}

export function buildEquipmentHandler(deps: EquipmentHandlerDependencies = createDefaultDependencies()) {
  return async function equipmentHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>('/equipment', listSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData) return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const items = await deps.findEquipmentByUser(user.id)
        return { items: items.map(itemView) }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/equipment/equip', equipSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, equipmentId, heroId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!equipmentId) return { error: 'No equipmentId provided' }
      if (!heroId) return { error: 'No heroId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const hero = await deps.findHeroForUser(user.id, heroId)
        if (!hero) return { error: 'Hero not found' }
        const result = await deps.equipItem(user.id, equipmentId, heroId)
        if (result !== 'ok') return { error: EQUIP_ERROR[result] }
        return { ok: true }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: Body }>('/equipment/unequip', unequipSchema, async (request) => {
      if (request.validationError) return { error: 'Invalid request body' }
      const { initData, equipmentId } = request.body
      if (!initData) return { error: 'No initData provided' }
      if (!equipmentId) return { error: 'No equipmentId provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const ok = await deps.unequipItem(user.id, equipmentId)
        if (!ok) return { error: 'Item not equipped' }
        return { ok: true }
      } catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}

const equipmentHandler = buildEquipmentHandler()

export default equipmentHandler
