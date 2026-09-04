import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { VisitRecord } from '#root/common/models/Visit'
import type { Move, PlaceDef } from '#root/game/places'
import { BalanceChangeType } from '#root/common/models/Balance'
import { movesFor, windowEndsAt, windowIdAt } from '#root/game/places'
import { topTraits, traitOf, weightOf } from '#root/game/traits'
import { safeErrorResponse } from './safe-error'

export interface WorldUser {
  id: number
  votes: bigint
  pass?: { index: number, address: string, name: string, image: string, traits?: Record<string, number> }
  rep?: { helped: number, stole: number, gave: number, took: number }
}

export interface WorldHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUser: (id: number) => Promise<WorldUser | null>
  findUserByPassIndex: (index: number) => Promise<WorldUser | null>
  now: () => number
  places: readonly PlaceDef[]
  countVisitsByPlace: (windowId: number) => Promise<Record<string, number>>
  getPool: (place: string, seed: bigint) => Promise<bigint>
  findVisit: (userId: number, windowId: number) => Promise<VisitRecord | null>
  lastResolvedVisit: (userId: number) => Promise<VisitRecord | null>
  findResolvedVisits: (userId: number, limit: number) => Promise<VisitRecord[]>
  debitVotes: (userId: number, amount: bigint, reason: BalanceChangeType) => Promise<bigint | null>
  addPoints: (userId: number, amount: bigint, reason: BalanceChangeType) => Promise<unknown>
  createVisit: (input: { userId: number, windowId: number, place: string, move: Move | null, stake: bigint, inviteCode?: string }) => Promise<VisitRecord | 'duplicate'>
  bindInvite: (windowId: number, place: string, inviteCode: string, joinerId: number) => Promise<{ hostId: number } | 'expired' | 'taken'>
  setPartner: (visitId: string, partnerId: number) => Promise<void>
  fetchTraits: (contentUri: string) => Promise<Record<string, number>>
  loadTraitsForPass: (passAddress: string) => Promise<Record<string, number>>
  setPassTraits: (userId: number, traits: Record<string, number>) => Promise<void>
  randomCode: () => string
  logError: (message: string) => void
}

const EMPTY_REP = { helped: 0, stole: 0, gave: 0, took: 0 }

export interface VisitView {
  id: string
  windowId: number
  place: string
  move: Move | null
  stake: string
  partnerId: number | null
  inviteCode?: string
  resolved: boolean
  payout: string | null
  outcome: string | null
}

export function visitView(v: VisitRecord, own: boolean): VisitView {
  return {
    id: v.id,
    windowId: v.windowId,
    place: v.place,
    move: v.move,
    stake: v.stake.toString(),
    partnerId: v.partnerId ?? null,
    ...(own && v.inviteCode ? { inviteCode: v.inviteCode } : {}),
    resolved: v.resolved,
    payout: v.payout === undefined ? null : v.payout.toString(),
    outcome: v.outcome ?? null,
  }
}

interface Body { initData: string }
interface VisitBody extends Body { place: string, move?: Move, inviteCode?: string }
interface HistoryBody extends Body { limit: number }

export function buildWorldHandler(deps: WorldHandlerDependencies) {
  type Holder = WorldUser & { pass: NonNullable<WorldUser['pass']> }

  async function holder(initData: string | undefined, reply: FastifyReply): Promise<Holder | null> {
    if (!initData) {
      void reply.code(400).send({ error: 'No initData provided' })
      return null
    }
    deps.validateInitData(initData)
    const parsed = deps.parseInitData(initData)
    const tgUserId = parsed?.user?.id
    const user = tgUserId ? await deps.findUser(tgUserId) : null
    if (!user) {
      void reply.code(400).send({ error: 'User not found' })
      return null
    }
    if (!user.pass) {
      void reply.code(403).send({ error: 'Hold a Cube Worlds pass to enter Bali', code: 'holder_required' })
      return null
    }
    return user as Holder
  }

  async function traitsFor(user: Holder): Promise<Record<string, number> | undefined> {
    if (user.pass.traits) return user.pass.traits
    try {
      const traits = await deps.loadTraitsForPass(user.pass.address)
      await deps.setPassTraits(user.id, traits)
      return traits
    } catch (err) {
      deps.logError(`Trait backfill failed for ${user.id}: ${(err as Error).message}`)
      return undefined
    }
  }

  function placeTraits(place: PlaceDef, traits: Record<string, number> | undefined) {
    return place.traits.map(name => ({ name, value: traitOf(traits, name) }))
  }

  return async function worldHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: Body }>(
      '/state',
      { schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } }, attachValidation: true },
      async (request, reply) => {
        if (request.validationError) return reply.code(400).send({ error: 'Invalid request body' })
        try {
          const user = await holder(request.body?.initData, reply)
          if (!user) return reply
          const windowId = windowIdAt(deps.now())
          const traits = await traitsFor(user)
          const [crowd, myVisit, lastOutcome] = await Promise.all([
            deps.countVisitsByPlace(windowId - 1),
            deps.findVisit(user.id, windowId),
            deps.lastResolvedVisit(user.id),
          ])
          const places = []
          for (const place of deps.places) {
            const pool = place.engine === 'commons' ? await deps.getPool(place.id, place.seed) : undefined
            places.push({
              id: place.id,
              name: place.name,
              lat: place.lat,
              lon: place.lon,
              engine: place.engine,
              open: place.open,
              traits: placeTraits(place, traits),
              weight: weightOf(traits, place.traits),
              stake: place.stake.toString(),
              pot: place.pot.toString(),
              bonus: place.bonus.toString(),
              lastCrowd: crowd[place.id] ?? 0,
              ...(pool === undefined ? {} : { pool: pool.toString() }),
            })
          }
          return {
            windowId,
            endsAt: windowEndsAt(windowId),
            places,
            myVisit: myVisit ? visitView(myVisit, true) : null,
            rep: user.rep ?? EMPTY_REP,
            lastOutcome: lastOutcome ? visitView(lastOutcome, true) : null,
            balance: user.votes.toString(),
          }
        } catch (err) {
          return safeErrorResponse(err, deps.logError)
        }
      },
    )

    fastify.post<{ Body: VisitBody }>(
      '/visit',
      {
        schema: {
          body: {
            type: 'object',
            required: ['place'],
            properties: {
              initData: { type: 'string', maxLength: 8192 },
              place: { type: 'string', maxLength: 32 },
              move: { type: 'string', enum: ['help', 'steal', 'give', 'take'] },
              inviteCode: { type: 'string', maxLength: 32 },
            },
          },
        },
        attachValidation: true,
      },
      async (request, reply) => {
        if (request.validationError) return reply.code(400).send({ error: 'Invalid request body', code: 'bad_move' })
        try {
          const user = await holder(request.body?.initData, reply)
          if (!user) return reply
          const { place: placeId, move, inviteCode } = request.body
          const place = deps.places.find(p => p.id === placeId)
          if (!place || !place.open || place.engine === 'rest') {
            return reply.code(400).send({ error: 'This place is not open', code: 'bad_place' })
          }
          const allowed = movesFor(place.engine)
          if ((allowed.length === 0 && move) || (allowed.length > 0 && (!move || !allowed.includes(move)))) {
            return reply.code(400).send({ error: 'Pick a move for this place', code: 'bad_move' })
          }
          const windowId = windowIdAt(deps.now())
          if (await deps.findVisit(user.id, windowId)) {
            return reply.code(409).send({ error: 'You already went somewhere this window', code: 'already_visited' })
          }

          if (inviteCode && place.engine !== 'split-steal') {
            return reply.code(400).send({ error: 'Invites only work at Canggu', code: 'bad_place' })
          }

          const left = await deps.debitVotes(user.id, place.stake, BalanceChangeType.Stake)
          if (left === null) {
            return reply.code(402).send({ error: `You need ${place.stake} $CUBE for ${place.name}`, code: 'no_cube', stake: place.stake.toString() })
          }

          let hostId: number | undefined
          if (inviteCode) {
            // Bind after the debit so a joiner who can't pay never strands the host's invite.
            const bound = await deps.bindInvite(windowId, place.id, inviteCode, user.id)
            if (bound === 'expired') {
              await deps.addPoints(user.id, place.stake, BalanceChangeType.Stake)
              return reply.code(410).send({ error: 'That meet link has expired', code: 'invite_expired' })
            }
            if (bound === 'taken') {
              await deps.addPoints(user.id, place.stake, BalanceChangeType.Stake)
              return reply.code(409).send({ error: 'Someone already took that meet', code: 'invite_taken' })
            }
            hostId = bound.hostId
          }

          const created = await deps.createVisit({
            userId: user.id,
            windowId,
            place: place.id,
            move: move ?? null,
            stake: place.stake,
            // `<passIndex>-<random>`: the meet landing reads the host's public pass from the prefix.
            inviteCode: place.engine === 'split-steal' && !inviteCode ? `${user.pass.index}-${deps.randomCode()}` : undefined,
          })
          if (created === 'duplicate') {
            await deps.addPoints(user.id, place.stake, BalanceChangeType.Stake)
            return reply.code(409).send({ error: 'You already went somewhere this window', code: 'already_visited' })
          }
          if (hostId !== undefined) {
            await deps.setPartner(created.id, hostId)
            created.partnerId = hostId
          }
          return reply.code(201).send(visitView(created, true))
        } catch (err) {
          return safeErrorResponse(err, deps.logError)
        }
      },
    )

    fastify.post<{ Body: HistoryBody }>(
      '/history',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              initData: { type: 'string', maxLength: 8192 },
              limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            },
          },
        },
        attachValidation: true,
      },
      async (request, reply) => {
        if (request.validationError) return reply.code(400).send({ error: 'Invalid request body' })
        try {
          const user = await holder(request.body?.initData, reply)
          if (!user) return reply
          const visits = await deps.findResolvedVisits(user.id, request.body.limit ?? 20)
          return { visits: visits.map(v => visitView(v, false)) }
        } catch (err) {
          return safeErrorResponse(err, deps.logError)
        }
      },
    )

    fastify.get<{ Params: { index: string } }>(
      '/pass/:index',
      { schema: { params: { type: 'object', required: ['index'], properties: { index: { type: 'integer', minimum: 0 } } } } },
      async (request, reply) => {
        try {
          const owner = await deps.findUserByPassIndex(Number(request.params.index))
          if (!owner?.pass) return reply.code(404).send({ error: 'No holder plays this pass' })
          const traits = owner.pass.traits
          return {
            index: owner.pass.index,
            name: owner.pass.name,
            image: owner.pass.image,
            rep: owner.rep ?? EMPTY_REP,
            weights: deps.places.filter(p => p.open && p.engine !== 'rest').map(p => ({ place: p.id, weight: weightOf(traits, p.traits) })),
            top: traits ? topTraits(traits, 5) : [],
          }
        } catch (err) {
          return safeErrorResponse(err, deps.logError)
        }
      },
    )
  }
}
