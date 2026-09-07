/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHawkDove } from '#root/game/engines/hawk-dove'

const v = (userId: number, move: 'hawk' | 'dove'): EngineVisit => ({ userId, move, stake: 100n })
const weights: Record<number, number> = { 1: 30, 2: 3 }
const weightOf = (id: number) => weights[id] ?? 10
const run = (visits: EngineVisit[], rng: () => number = () => 0) => resolveHawkDove('Kuta', visits, 100n, weightOf, rng)

test('dove/dove: both keep the stake plus the bonus, no rep', () => {
  const { outcomes } = run([v(1, 'dove'), v(2, 'dove')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout, o.partnerId]).sort(), [[1, 120n, 2], [2, 120n, 1]])
  assert.equal(outcomes[0].rep, undefined)
  assert.equal(outcomes[0].outcome, 'Kuta · both backed down · +120')
})

test('hawk/dove: hawk takes 150, dove keeps 50', () => {
  const { outcomes } = run([v(1, 'hawk'), v(2, 'dove')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 150n], [2, 50n]])
  assert.deepEqual(outcomes[0].rep, { took: 1 })
  assert.equal(outcomes[1].rep, undefined)
})

test('hawk/hawk: weight-weighted coin, winner 50, loser 0, 150 burns', () => {
  // 30 / (30 + 3) ≈ 0.91: rng 0.5 → user 1 wins, rng 0.95 → user 2 wins
  const won = run([v(1, 'hawk'), v(2, 'hawk')], () => 0.5).outcomes
  assert.deepEqual(won.map(o => [o.userId, o.payout]), [[1, 50n], [2, 0n]])
  assert.deepEqual(won.map(o => o.rep), [{ took: 1 }, { took: 1 }])
  const lost = run([v(1, 'hawk'), v(2, 'hawk')], () => 0.95).outcomes
  assert.deepEqual(lost.map(o => [o.userId, o.payout]), [[2, 50n], [1, 0n]])
})

test('odd one out is refunded', () => {
  const { outcomes } = run([v(1, 'hawk'), v(2, 'dove'), v(3, 'dove')])
  const alone = outcomes.find(o => o.refund)!
  assert.equal(alone.payout, 100n)
  assert.match(alone.outcome, /nobody to fight/)
  assert.equal(outcomes.length, 3)
})
