/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { TournamentHandlerDependencies } from '#root/backend/tournament-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildTournamentHandler } from '#root/backend/tournament-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

function makeDeps(overrides: Partial<TournamentHandlerDependencies> = {}) {
  const calls = {
    entered: [] as Array<{ userId: number, weekId: number, bonus: boolean }>,
    addPoints: [] as Array<{ add: bigint, reason: BalanceChangeType }>,
    entrantsBumped: 0,
  }
  const deps: TournamentHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, _id: 'u7', votes: 10_000n } as any) : null),
    currentWeekId: () => 2900,
    weekEndMs: weekId => weekId * 1000,
    entryFeeCube: 2000,
    findOrCreateTournament: async () => {},
    findTournament: async () => ({ entrantCount: 3, entryFeeCube: 2000 }),
    enterTournament: async (userId, weekId, bonus) => { calls.entered.push({ userId, weekId, bonus }); return { _id: 'e1' } },
    incrementEntrants: async () => { calls.entrantsBumped++ },
    findEntries: async () => [{ userId: 7, bonus: false }, { userId: 9, bonus: false }],
    isSeasonPassActive: async () => false,
    addPoints: async (_id, add, reason) => { calls.addPoints.push({ add, reason }); return 8_000n },
    spendReason: BalanceChangeType.Spend,
    poolBalance: async () => 5_000_000n,
    scoreForWeek: async () => new Map<number, bigint>([[9, 500n], [7, 300n]]),
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

async function appWith(d: TournamentHandlerDependencies) {
  const app = fastify()
  await app.register(buildTournamentHandler(d), { prefix: '/api/game' })
  return app
}

test('paid entry debits exactly the entry fee and creates one entry', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/tournament/enter', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.bonus, false)
  assert.equal(body.entryFeeCube, 2000)
  assert.deepEqual(calls.entered, [{ userId: 7, weekId: 2900, bonus: false }])
  assert.equal(calls.addPoints[0].add, -2000n)
  assert.equal(calls.addPoints[0].reason, BalanceChangeType.Spend)
  assert.equal(calls.entrantsBumped, 1)
})

test('insufficient CUBE: no entry, no debit', async (t) => {
  const { deps, calls } = makeDeps({
    findUserById: async () => ({ id: 7, _id: 'u7', votes: 100n } as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/tournament/enter', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'Not enough CUBE')
  assert.equal(calls.entered.length, 0)
  assert.equal(calls.addPoints.length, 0)
})

test('duplicate entry: friendly error, no second debit', async (t) => {
  const { deps, calls } = makeDeps({
    enterTournament: async () => { throw Object.assign(new Error('dup'), { code: 11000 }) },
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/tournament/enter', payload: { initData: 'x' } })
  assert.equal(res.json().error, 'Already entered this week')
  assert.equal(calls.addPoints.length, 0)
})

test('season-pass holder enters free (bonus, no debit)', async (t) => {
  const { deps, calls } = makeDeps({ isSeasonPassActive: async () => true })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/tournament/enter', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.bonus, true)
  assert.equal(body.entryFeeCube, 0)
  assert.equal(calls.entered[0].bonus, true)
  assert.equal(calls.addPoints.length, 0)
})

test('status returns pool, entrant count, and a descending ranked leaderboard', async (t) => {
  const { deps } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/tournament', payload: { initData: 'x' } })
  const body = res.json()
  assert.equal(body.weekId, 2900)
  assert.equal(body.entrantCount, 3)
  assert.equal(body.prizePoolUsdt, 5) // 5_000_000 micro
  // user 9 (500) outranks user 7 (300)
  assert.deepEqual(body.leaderboard, [
    { userId: 9, score: 500, rank: 1 },
    { userId: 7, score: 300, rank: 2 },
  ])
  assert.equal(body.myEntry.entered, true)
  assert.equal(body.myEntry.rank, 2)
  assert.equal(body.myEntry.score, 300)
})
