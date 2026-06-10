/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { PvpHandlerDependencies } from '#root/backend/pvp-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildPvpHandler } from '#root/backend/pvp-handler'

const DAY = 86_400_000
const NOW = new Date(DAY * 20_614) // a fixed UTC instant; dayBucket(NOW) === 20614

function makeDeps(overrides: Partial<PvpHandlerDependencies> = {}) {
  const calls = {
    debits: [] as any[],
    refunds: [] as any[],
    rating: [] as any[],
    plunders: [] as any[],
    credits: [] as any[],
    ledger: [] as any[],
    xp: [] as any[],
    shields: [] as any[],
    created: [] as any[],
    resolved: [] as any[],
    slotClaims: [] as any[],
    slotReleases: [] as any[],
    matchLoot: [] as any[],
    fed: [] as any[],
  }
  const attackerHero = { _id: 'h1', userId: 7, heroClass: 'knight', level: 5, xp: 1000 }
  const defenderHero = { _id: 'h9', userId: 9, heroClass: 'mage', level: 5, xp: 0 }
  const profile = { userId: 7, rating: 1000, wins: 2, losses: 1, shieldUntil: null, raidDay: -1, raidsToday: 0 }
  let matchAutoId = 0
  const deps: PvpHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 7 } }) as InitData,
    findUserById: async id => (id === 7 ? ({ id: 7, name: 'attacker' } as any) : id === 9 ? ({ id: 9, name: 'defender' } as any) : null),
    findHeroForUser: async (u, id) => (u === 7 && id === 'h1' ? (attackerHero as any) : null),
    findHeroesByUser: async u => (u === 9 ? ([defenderHero] as any) : []),
    findEquippedForHero: async () => [],
    findActiveQuestForHero: async () => null,
    findOrCreatePvpProfile: async () => profile as any,
    findArenaOpponent: async () => ({ userId: 9, rating: 1040 }),
    findRaidTarget: async () => ({ userId: 9, rating: 1040 }),
    findCastleByUserId: async id => ({ _id: `c${id}`, userId: id, walls: 4 } as any),
    findOrCreateCastle: async user => ({ _id: `c${user.id}`, userId: user.id, walls: 0 } as any),
    debitVotes: async (u, amount, reason) => { calls.debits.push({ u, amount, reason }); return 100_000n },
    addPoints: async (u, amount, reason) => { calls.refunds.push({ u, amount, reason }); return 100_000n },
    spendResources: async (castleId, cost) => { calls.fed.push({ castleId, cost }); return true },
    plunderResources: async (castleId, bps) => { calls.plunders.push({ castleId, bps }); return { gold: 100, iron: 50, mana: 5, food: 20 } },
    creditResources: async (castleId, gain) => { calls.credits.push({ castleId, gain }) },
    addResourceRecords: async (u, rows) => { calls.ledger.push({ u, rows }) },
    claimRaidSlot: async (u, day) => { calls.slotClaims.push({ u, day }); return true },
    releaseRaidSlot: async (u, day) => { calls.slotReleases.push({ u, day }) },
    setShield: async (u, until) => { calls.shields.push({ u, until }) },
    applyRatingDelta: async (u, delta, won) => { calls.rating.push({ u, delta, won }) },
    createPendingMatch: async (input) => {
      matchAutoId += 1
      const m = { _id: `m${matchAutoId}`, status: 'pending', xpGained: 0, lootGold: 0, lootIron: 0, lootMana: 0, lootFood: 0, createdAt: NOW, ...input }
      calls.created.push(m)
      return m as any
    },
    findPendingMatchByAttacker: async () => null,
    resolveMatchCas: async (id, result) => { calls.resolved.push({ id, result }); return true },
    recordMatchLoot: async (id, loot) => { calls.matchLoot.push({ id, loot }) },
    findRecentMatches: async () => [],
    grantHeroXp: async (id, xp, level) => { calls.xp.push({ id, xp, level }) },
    now: () => NOW,
    logError: () => {},
    ...overrides,
  }
  return { deps, calls, profile, attackerHero, defenderHero }
}

async function appWith(d: PvpHandlerDependencies) {
  const app = fastify()
  await app.register(buildPvpHandler(d), { prefix: '/api/game' })
  return app
}

test('pvp status returns ladder, raid allowance, costs, and history', async (t) => {
  const { deps } = makeDeps({
    findRecentMatches: async () => ([{
      _id: 'm0', mode: 'raid', attackerId: 9, defenderId: 7, status: 'resolved', attackerWon: true,
      ratingDelta: 12, xpGained: 0, lootGold: 33, lootIron: 0, lootMana: 0, lootFood: 7,
      attacker: { userId: 9, name: 'defender', heroId: 'h9', heroClass: 'mage', level: 5, rating: 1040, hp: 1, atk: 1, def: 1 },
      defender: { userId: 7, name: 'attacker', heroId: 'h1', heroClass: 'knight', level: 5, rating: 1000, hp: 1, atk: 1, def: 1 },
      createdAt: NOW,
    }] as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/pvp', payload: { initData: 'x' } })).json()
  assert.equal(body.rating, 1000)
  assert.equal(body.wins, 2)
  assert.equal(body.raidsLeft, 3)
  assert.equal(body.arenaEntryCube, '10')
  assert.equal(body.raidStakeCube, '50')
  assert.equal(body.matches.length, 1)
  // The defender's view of a lost raid: youAttacked=false, youWon=false, negated delta.
  assert.equal(body.matches[0].youAttacked, false)
  assert.equal(body.matches[0].youWon, false)
  assert.equal(body.matches[0].ratingDelta, -12)
  assert.equal(body.matches[0].loot.gold, 33)
  assert.equal(body.matches[0].opponent.name, 'defender')
})

test('pvp status counts raid slots used today and reports an active shield', async (t) => {
  const { deps } = makeDeps({
    findOrCreatePvpProfile: async () => ({
      userId: 7, rating: 900, wins: 0, losses: 5,
      shieldUntil: new Date(NOW.getTime() + 60_000), raidDay: 20_614, raidsToday: 2,
    } as any),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/pvp', payload: { initData: 'x' } })).json()
  assert.equal(body.raidsLeft, 1)
  assert.ok(body.shieldUntil)
})

test('pvp status sweeps a crash-stranded pending match before reporting', async (t) => {
  const stranded = {
    _id: 'mStranded', mode: 'arena', attackerId: 7, defenderId: 9, stake: 0, status: 'pending',
    attacker: { userId: 7, name: 'attacker', heroId: 'h1', heroClass: 'knight', level: 5, rating: 1000, hp: 192, atk: 30, def: 20 },
    defender: { userId: 9, name: 'defender', heroId: 'h9', heroClass: 'mage', level: 5, rating: 1040, hp: 120, atk: 48, def: 10 },
  }
  const { deps, calls } = makeDeps({ findPendingMatchByAttacker: async () => stranded as any })
  const app = await appWith(deps)
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/game/pvp', payload: { initData: 'x' } })
  assert.equal(res.statusCode, 200)
  assert.equal(calls.resolved.length, 1)
  assert.equal(calls.resolved[0].id, 'mStranded')
  assert.equal(calls.rating.length, 2) // both sides moved
})
