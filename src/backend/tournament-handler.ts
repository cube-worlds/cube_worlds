import type { InitData } from '@telegram-apps/init-data-node'
import type { FastifyInstance } from 'fastify'
import type { BalanceChangeType } from '#root/common/models/Balance'
import type { findUserById } from '#root/common/models/User'
import { ClientError } from '#root/common/errors'
import { microToUsdt } from '#root/common/helpers/wallet'
import { safeErrorResponse } from './safe-error'

type ExistingUser = NonNullable<Awaited<ReturnType<typeof findUserById>>>

// A leaderboard row, already sorted/ranked by the handler.
export interface LeaderRow {
  userId: number
  score: number
  rank: number
}

export interface TournamentHandlerDependencies {
  validateInitData: (initData: string) => void
  parseInitData: (initData: string) => InitData
  findUserById: (id: number) => Promise<ExistingUser | null>
  currentWeekId: () => number
  weekEndMs: (weekId: number) => number
  entryFeeCube: number
  findOrCreateTournament: (weekId: number) => Promise<void>
  findTournament: (weekId: number) => Promise<{ entrantCount: number, entryFeeCube: number } | null>
  enterTournament: (userId: number, weekId: number, bonus: boolean) => Promise<{ _id: unknown }>
  incrementEntrants: (weekId: number) => Promise<void>
  findEntries: (weekId: number) => Promise<Array<{ userId: number, bonus: boolean }>>
  isSeasonPassActive: (userId: number) => Promise<boolean>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  spendReason: BalanceChangeType
  poolBalance: () => Promise<bigint>
  scoreForWeek: (weekId: number, userIds: number[]) => Promise<Map<number, bigint>>
  logError: (message: string) => void
}

async function findUserByInitData(initData: string, deps: TournamentHandlerDependencies) {
  deps.validateInitData(initData)
  const parsed = deps.parseInitData(initData)
  const tgUserId = parsed?.user?.id
  if (!tgUserId)
    throw new ClientError('Invalid telegram user id')
  const user = await deps.findUserById(tgUserId)
  if (!user)
    throw new ClientError('User not found in database')
  return user
}

const bodySchema = {
  schema: { body: { type: 'object', properties: { initData: { type: 'string', maxLength: 8192 } } } },
  attachValidation: true,
} as const

// Build a descending, ranked leaderboard from a score map, capped to `limit`.
function rankLeaderboard(scores: Map<number, bigint>, limit: number): LeaderRow[] {
  return [...scores.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0] - b[0] : (b[1] > a[1] ? 1 : -1)))
    .slice(0, limit)
    .map(([userId, score], i) => ({ userId, score: Number(score), rank: i + 1 }))
}

const LEADERBOARD_LIMIT = 20

export function buildTournamentHandler(deps: TournamentHandlerDependencies) {
  return async function tournamentHandler(fastify: FastifyInstance) {
    fastify.post<{ Body: { initData: string } }>('/tournament', bodySchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const weekId = deps.currentWeekId()
        await deps.findOrCreateTournament(weekId)

        const tournament = await deps.findTournament(weekId)
        const pool = await deps.poolBalance()
        const entries = await deps.findEntries(weekId)
        const scores = await deps.scoreForWeek(weekId, entries.map(e => e.userId))
        const leaderboard = rankLeaderboard(scores, LEADERBOARD_LIMIT)

        const myEntry = entries.find(e => e.userId === user.id)
        const myRank = leaderboard.find(r => r.userId === user.id)?.rank ?? null

        return {
          weekId,
          weekEnd: deps.weekEndMs(weekId),
          entrantCount: tournament?.entrantCount ?? entries.length,
          entryFeeCube: tournament?.entryFeeCube ?? deps.entryFeeCube,
          prizePoolUsdt: microToUsdt(pool),
          leaderboard,
          myEntry: myEntry
            ? { entered: true, bonus: myEntry.bonus, score: Number(scores.get(user.id) ?? 0n), rank: myRank }
            : { entered: false },
        }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })

    fastify.post<{ Body: { initData: string } }>('/tournament/enter', bodySchema, async (request) => {
      if (request.validationError)
        return { error: 'Invalid request body' }
      const { initData } = request.body
      if (!initData)
        return { error: 'No initData provided' }
      try {
        const user = await findUserByInitData(initData, deps)
        const weekId = deps.currentWeekId()
        await deps.findOrCreateTournament(weekId)

        // A Season Pass waives the entry fee (the holder's free weekly entry).
        const bonus = await deps.isSeasonPassActive(user.id)
        if (!bonus && user.votes < BigInt(deps.entryFeeCube)) {
          throw new ClientError('Not enough CUBE')
        }

        // Enter first so the unique (userId, weekId) index rejects a duplicate
        // BEFORE any debit. The debit follows on success. A crash in the gap
        // leaves a free entry rather than charging without entering — the safe
        // bias for a sink (mirrors the expedition handler's spend-gated order).
        try {
          await deps.enterTournament(user.id, weekId, bonus)
        }
        catch (err) {
          if ((err as { code?: number }).code === 11000) {
            throw new ClientError('Already entered this week')
          }
          throw err
        }

        if (!bonus) {
          await deps.addPoints(user.id, -BigInt(deps.entryFeeCube), deps.spendReason)
        }
        await deps.incrementEntrants(weekId)

        return { weekId, entryFeeCube: bonus ? 0 : deps.entryFeeCube, bonus }
      }
      catch (err) {
        return safeErrorResponse(err, deps.logError)
      }
    })
  }
}
