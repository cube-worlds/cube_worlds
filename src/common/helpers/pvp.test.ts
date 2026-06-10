/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCombat } from '#root/common/helpers/combat'
import {
  ARENA_ENTRY_CUBE,
  combatPower,
  ELO_K,
  eloDelta,
  matchSeed,
  plunderAmounts,
  RAID_LOOT_BPS,
  RAID_STAKE_CUBE,
  RAIDS_PER_DAY,
  RATING_FLOOR,
  shieldActive,
  wallsBonus,
} from '#root/common/helpers/pvp'

test('economy constants match the approved spec', () => {
  assert.equal(ARENA_ENTRY_CUBE, 10n)
  assert.equal(RAID_STAKE_CUBE, 50n)
  assert.equal(RAID_LOOT_BPS, 1000)
  assert.equal(RAIDS_PER_DAY, 3)
})

test('eloDelta: a win never decreases, a loss never increases, and bounded by K', () => {
  for (const [a, b] of [[1000, 1000], [1000, 1400], [1400, 1000], [100, 3000]]) {
    const win = eloDelta(a, b, true)
    const loss = eloDelta(a, b, false)
    assert.ok(win >= 1 && win <= ELO_K, `win delta ${win} out of range`)
    assert.ok(loss <= -1 && loss >= -ELO_K, `loss delta ${loss} out of range`)
  }
})

test('eloDelta is zero-sum across the pair', () => {
  // Attacker's win delta must exactly cancel the defender's loss delta.
  for (const [a, b] of [[1000, 1000], [1200, 1000], [1000, 1400], [100, 3000]]) {
    const atkDelta = eloDelta(a, b, true)
    const defDelta = eloDelta(b, a, false)
    assert.equal(atkDelta + defDelta, 0, `non-zero sum: a=${a} b=${b}`)
  }
})

test('eloDelta pays more for beating a stronger opponent', () => {
  assert.ok(eloDelta(1000, 1400, true) > eloDelta(1000, 600, true))
})

test('RATING_FLOOR is 100', () => {
  assert.equal(RATING_FLOOR, 100)
})

test('matchSeed is stable and distinct per match id', () => {
  assert.equal(matchSeed('abc'), matchSeed('abc'))
  assert.notEqual(matchSeed('abc'), matchSeed('abd'))
})

test('a matchSeed fight is reproducible 1000 times (Phase B exit criterion holds for PvP)', () => {
  const seed = matchSeed('6650f1c2aa00bb11cc22dd33')
  const a = { hp: 200, atk: 30, def: 10 }
  const b = { hp: 180, atk: 28, def: 12 }
  const first = resolveCombat(seed, a, b)
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(resolveCombat(seed, a, b), first)
  }
})

test('wallsBonus boosts hp/def by 5% per level (floored), never atk, capped at level 10', () => {
  const base = { hp: 100, atk: 20, def: 10 }
  assert.deepEqual(wallsBonus(base, 0), { hp: 100, atk: 20, def: 10 })
  assert.deepEqual(wallsBonus(base, 4), { hp: 120, atk: 20, def: 12 })
  assert.deepEqual(wallsBonus(base, 10), { hp: 150, atk: 20, def: 15 })
  assert.deepEqual(wallsBonus(base, 99), wallsBonus(base, 10))
})

test('plunderAmounts takes floor(10%) of each bag and never goes negative', () => {
  assert.deepEqual(
    plunderAmounts({ gold: 1009, iron: 55, mana: 9, food: 0 }),
    { gold: 100, iron: 5, mana: 0, food: 0 },
  )
})

test('combatPower is monotonic in every stat', () => {
  const base = combatPower({ hp: 100, atk: 20, def: 10 })
  assert.ok(combatPower({ hp: 101, atk: 20, def: 10 }) > base)
  assert.ok(combatPower({ hp: 100, atk: 21, def: 10 }) > base)
  assert.ok(combatPower({ hp: 100, atk: 20, def: 11 }) > base)
})

test('shieldActive respects the clock', () => {
  const now = new Date('2026-06-10T12:00:00Z')
  assert.equal(shieldActive(new Date('2026-06-10T13:00:00Z'), now), true)
  assert.equal(shieldActive(new Date('2026-06-10T11:00:00Z'), now), false)
  assert.equal(shieldActive(null, now), false)
  assert.equal(shieldActive(undefined, now), false)
})
