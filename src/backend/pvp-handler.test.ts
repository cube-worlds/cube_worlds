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

test('arena/fight debits the entry burn, snapshots both sides, resolves, moves ELO and grants XP', async (t) => {
  const { deps, calls } = makeDeps()
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(typeof body.win, 'boolean')
  assert.ok(Array.isArray(body.rounds) && body.rounds.length > 0)
  assert.equal(body.opponent.name, 'defender')
  // Entry fee: exactly one debit of 10n, reason ArenaEntry (13), never refunded.
  assert.equal(calls.debits.length, 1)
  assert.equal(calls.debits[0].amount, 10n)
  assert.equal(calls.debits[0].reason, 13)
  assert.equal(calls.refunds.length, 0)
  // Snapshot carries at-insert ratings (attacker 1000, defender 1040).
  assert.equal(calls.created.length, 1)
  assert.equal(calls.created[0].attacker.rating, 1000)
  assert.equal(calls.created[0].defender.rating, 1040)
  // Both sides moved, zero-sum, and the attacker hero got XP.
  assert.equal(calls.rating.length, 2)
  assert.equal(calls.rating[0].delta + calls.rating[1].delta, 0)
  assert.equal(calls.xp.length, 1)
  // Arena never touches resources or shields.
  assert.equal(calls.plunders.length, 0)
  assert.equal(calls.shields.length, 0)
})

test('arena/fight refunds the entry when no opponent exists', async (t) => {
  const { deps, calls } = makeDeps({ findArenaOpponent: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'No opponent found')
  assert.equal(calls.refunds.length, 1)
  assert.equal(calls.refunds[0].amount, 10n)
  assert.equal(calls.created.length, 0)
})

test('arena/fight refunds when the matched opponent has no living roster', async (t) => {
  const { deps, calls } = makeDeps({ findHeroesByUser: async () => [] })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'No opponent found')
  assert.equal(calls.refunds.length, 1)
})

test('arena/fight rejects when CUBE is short', async (t) => {
  const { deps, calls } = makeDeps({ debitVotes: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Not enough CUBE')
  assert.equal(calls.created.length, 0)
})

test('arena/fight rejects a hero away on a quest (occupancy guard)', async (t) => {
  const { deps, calls } = makeDeps({ findActiveQuestForHero: async () => ({ _id: 'q1' }) })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Hero is away on a quest')
  assert.equal(calls.debits.length, 0)
})

test('arena/fight rejects a hero the user does not own', async (t) => {
  const { deps } = makeDeps({ findHeroForUser: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Hero not found')
})

test('arena/fight on a lost resolve CAS (concurrent) credits nothing', async (t) => {
  const { deps, calls } = makeDeps({ resolveMatchCas: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(typeof body.win, 'boolean') // deterministic result still returned
  assert.equal(calls.rating.length, 0)
  assert.equal(calls.xp.length, 0)
})

test('equipped gear changes an arena fight (same opponent, same seed path)', async (t) => {
  const bare = makeDeps()
  const appBare = await appWith(bare.deps)
  t.after(() => appBare.close())
  const r1 = (await appBare.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()

  const geared = makeDeps({
    findEquippedForHero: async heroId => (heroId === 'h1' ? [{ bonusHp: 0, bonusAtk: 60, bonusDef: 0 }] : []),
  })
  const appGeared = await appWith(geared.deps)
  t.after(() => appGeared.close())
  const r2 = (await appGeared.inject({ method: 'POST', url: '/api/game/arena/fight', payload: { initData: 'x', heroId: 'h1' } })).json()
  // Both harnesses mint match id m1 → identical seed; only the gear differs.
  assert.notDeepEqual(r1.rounds, r2.rounds)
})

test('raid/attack claims a slot, stakes CUBE, pays Food, and on a win refunds stake + plunders + shields', async (t) => {
  // Stack the attacker so the win is certain: max gear vs a level-1 defender.
  const weakDefender = { _id: 'h9', userId: 9, heroClass: 'mage', level: 1, xp: 0 }
  const { deps, calls } = makeDeps({
    findHeroesByUser: async u => (u === 9 ? ([weakDefender] as any) : []),
    findEquippedForHero: async heroId => (heroId === 'h1' ? [{ bonusHp: 500, bonusAtk: 200, bonusDef: 100 }] : []),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.win, true)
  assert.equal(body.stakeReturned, true)
  assert.deepEqual(body.loot, { gold: 100, iron: 50, mana: 5, food: 20 })
  // Slot claimed for dayBucket(NOW), never released on the happy path.
  assert.deepEqual(calls.slotClaims, [{ u: 7, day: 20_614 }])
  assert.equal(calls.slotReleases.length, 0)
  // Stake debited (50n, RaidStake=14) and refunded on the win.
  assert.equal(calls.debits.length, 1)
  assert.equal(calls.debits[0].amount, 50n)
  assert.equal(calls.debits[0].reason, 14)
  assert.equal(calls.refunds.length, 1)
  assert.equal(calls.refunds[0].amount, 50n)
  // Food upkeep spent and ledgered (negative Raid row).
  assert.equal(calls.fed.length, 1)
  assert.equal(calls.fed[0].cost.food, 25)
  // Plunder hit the DEFENDER castle; credit hit the ATTACKER castle.
  assert.equal(calls.plunders.length, 1)
  assert.equal(calls.plunders[0].castleId, 'c9')
  assert.equal(calls.credits[0].castleId, 'c7')
  // Ledger rows both directions + the upkeep row.
  assert.equal(calls.ledger.length, 3)
  // Defender shielded for 8h from NOW.
  assert.equal(calls.shields.length, 1)
  assert.equal(calls.shields[0].u, 9)
  assert.equal(calls.shields[0].until.getTime(), NOW.getTime() + 8 * 60 * 60 * 1000)
  // ELO moved both ways; raids grant no XP.
  assert.equal(calls.rating.length, 2)
  assert.equal(calls.xp.length, 0)
})

test('raid/attack on a LOST fight burns the stake and never plunders or shields', async (t) => {
  // Stack the defender so the loss is certain.
  const strongDefender = { _id: 'h9', userId: 9, heroClass: 'knight', level: 30, xp: 0 }
  const { deps, calls } = makeDeps({
    findHeroesByUser: async u => (u === 9 ? ([strongDefender] as any) : []),
  })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.win, false)
  assert.equal(body.stakeReturned, false)
  assert.equal(calls.refunds.length, 0) // the stake stays burned
  assert.equal(calls.plunders.length, 0)
  assert.equal(calls.shields.length, 0)
  assert.equal(calls.rating.length, 2) // ELO still moves — raids are on the ladder
})

test('raid/attack rejects when the daily cap is hit and releases nothing', async (t) => {
  const { deps, calls } = makeDeps({ claimRaidSlot: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Raid limit reached for today')
  assert.equal(calls.debits.length, 0)
  assert.equal(calls.slotReleases.length, 0)
})

test('raid/attack releases the slot when no target exists', async (t) => {
  const { deps, calls } = makeDeps({ findRaidTarget: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'No raid target found')
  assert.deepEqual(calls.slotReleases, [{ u: 7, day: 20_614 }])
  assert.equal(calls.debits.length, 0)
})

test('raid/attack releases the slot when CUBE is short', async (t) => {
  const { deps, calls } = makeDeps({ debitVotes: async () => null })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Not enough CUBE')
  assert.equal(calls.slotReleases.length, 1)
})

test('raid/attack refunds the stake and releases the slot when Food is short', async (t) => {
  const { deps, calls } = makeDeps({ spendResources: async () => false })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'Not enough Food')
  assert.equal(calls.refunds.length, 1)
  assert.equal(calls.refunds[0].amount, 50n)
  assert.equal(calls.slotReleases.length, 1)
  assert.equal(calls.ledger.length, 0) // upkeep is ledgered only after the spend wins
})

test('raid/attack refunds everything when the target turns out to have no roster', async (t) => {
  const { deps, calls } = makeDeps({ findHeroesByUser: async () => [] })
  const app = await appWith(deps)
  t.after(() => app.close())
  const body = (await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })).json()
  assert.equal(body.error, 'No raid target found')
  assert.equal(calls.refunds.length, 1) // stake back
  // Food credited back to the attacker castle + a compensating ledger row.
  assert.equal(calls.credits.length, 1)
  assert.equal(calls.credits[0].gain.food, 25)
  assert.equal(calls.slotReleases.length, 1)
})

test('the raid defender snapshot carries the walls bonus', async (t) => {
  const { deps, calls } = makeDeps() // defender castle has walls: 4 (makeDeps default)
  const app = await appWith(deps)
  t.after(() => app.close())
  await app.inject({ method: 'POST', url: '/api/game/raid/attack', payload: { initData: 'x', heroId: 'h1' } })
  const snap = calls.created[0].defender
  // mage L5: base hp 120, def 10 → walls 4 = +20% → hp 144, def 12; atk untouched (48).
  assert.equal(snap.hp, 144)
  assert.equal(snap.def, 12)
  assert.equal(snap.atk, 48)
})
