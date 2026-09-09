/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveVolunteer } from '#root/game/engines/volunteer'

const v = (userId: number, move: 'dive' | 'wait'): EngineVisit => ({ userId, move, stake: 100n })
const weights: Record<number, number> = { 1: 30, 2: 10 }
const weightOf = (id: number) => weights[id] ?? 10
const run = (visits: EngineVisit[], rng: () => number = () => 0) => resolveVolunteer('Amed', visits, 100n, 1000n, 5000n, weightOf, rng)

test('nobody dives: everyone loses the stake', () => {
  const { outcomes } = run([v(1, 'wait'), v(2, 'wait')])
  assert.deepEqual(outcomes.map(o => o.payout), [0n, 0n])
  assert.equal(outcomes[0].outcome, 'Amed · nobody dived · lost 100')
})

test('one diver is the hero at 200, waiters get 150', () => {
  const { outcomes } = run([v(2, 'dive'), v(3, 'wait'), v(4, 'wait')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[2, 200n], [3, 150n], [4, 150n]])
  assert.deepEqual(outcomes[0].rep, { helped: 1 })
  assert.equal(outcomes[1].rep, undefined)
})

test('two divers: top weight is the hero, the other earns less than a waiter', () => {
  const { outcomes } = run([v(2, 'dive'), v(1, 'dive'), v(3, 'wait')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[2, 120n], [1, 200n], [3, 150n]])
  assert.deepEqual(outcomes.map(o => o.rep), [{ helped: 1 }, { helped: 1 }, undefined])
})

test('solo visitors still play', () => {
  assert.equal(run([v(1, 'dive')]).outcomes[0].payout, 200n)
  assert.equal(run([v(1, 'wait')]).outcomes[0].payout, 0n)
})

test('tied weight: rng picks the hero', () => {
  assert.equal(run([v(3, 'dive'), v(4, 'dive')], () => 0).outcomes.find(o => o.payout === 200n)!.userId, 4)
  assert.equal(run([v(3, 'dive'), v(4, 'dive')], () => 0.99).outcomes.find(o => o.payout === 200n)!.userId, 3)
})
