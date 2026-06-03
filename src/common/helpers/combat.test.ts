/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashSeed,
  makeRng,
  MAX_ROUNDS,
  resolveCombat,
  resolveHeroCombat,
} from '#root/common/helpers/combat'

test('makeRng is deterministic per seed and varies across seeds', () => {
  const a = makeRng(42); const b = makeRng(42); const c = makeRng(43)
  const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()]; const seqC = [c(), c(), c()]
  assert.deepEqual(seqA, seqB)
  assert.notDeepEqual(seqA, seqC)
  for (const v of seqA) { assert.ok(v >= 0 && v < 1) }
})

test('hashSeed is deterministic and returns a uint32', () => {
  assert.equal(hashSeed('7:abc:19876'), hashSeed('7:abc:19876'))
  assert.notEqual(hashSeed('a'), hashSeed('b'))
  assert.ok(Number.isInteger(hashSeed('x')) && hashSeed('x') >= 0)
})

test('resolveCombat is fully reproducible across 1000 repeats of the same inputs', () => {
  const hero = { hp: 120, atk: 18, def: 12 }
  const enemy = { hp: 90, atk: 20, def: 8 }
  const first = resolveCombat(12345, hero, enemy)
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(resolveCombat(12345, hero, enemy), first)
  }
})

test('1000 distinct seeds all terminate within MAX_ROUNDS and are individually reproducible', () => {
  const hero = { hp: 100, atk: 22, def: 9 }
  const enemy = { hp: 100, atk: 22, def: 9 }
  for (let s = 0; s < 1000; s++) {
    const r1 = resolveCombat(s, hero, enemy)
    const r2 = resolveCombat(s, hero, enemy)
    assert.deepEqual(r1, r2)
    assert.ok(r1.rounds.length <= MAX_ROUNDS)
  }
})

test('a stalemate (both deal 1 dmg, huge hp) terminates at MAX_ROUNDS with no win', () => {
  const tank = { hp: 100000, atk: 1, def: 100 }
  const r = resolveCombat(1, tank, { hp: 100000, atk: 1, def: 100 })
  assert.equal(r.win, false)
  assert.ok(r.rounds.length <= MAX_ROUNDS)
})

test('an overwhelming hero wins; an outclassed hero loses', () => {
  assert.equal(resolveCombat(5, { hp: 500, atk: 100, def: 50 }, { hp: 30, atk: 5, def: 1 }).win, true)
  assert.equal(resolveCombat(5, { hp: 30, atk: 5, def: 1 }, { hp: 500, atk: 100, def: 50 }).win, false)
})

test('resolveHeroCombat derives stats from class+level', () => {
  const r = resolveHeroCombat(999, 'knight', 1, { hp: 1, atk: 1, def: 0 })
  assert.equal(r.win, true)
})
