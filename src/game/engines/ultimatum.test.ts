/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveUltimatum } from '#root/game/engines/ultimatum'

type M = 'fair' | 'greedy' | 'strict'
const v = (userId: number, move: M): EngineVisit => ({ userId, move, stake: 100n })
const weights: Record<number, number> = { 1: 30, 2: 10 }
const weightOf = (id: number) => weights[id] ?? 10
const run = (visits: EngineVisit[], rng: () => number = () => 0) => resolveUltimatum('Gili Trawangan', visits, 100n, 100n, 1000n, 5000n, weightOf, rng)
const pay = (visits: EngineVisit[], rng?: () => number) => run(visits, rng).outcomes.map(o => [o.userId, o.payout])

test('the heavier visitor proposes; fair or strict proposer splits 150/150 and is marked gave', () => {
  for (const move of ['fair', 'strict'] as const) {
    const { outcomes } = run([v(2, 'greedy'), v(1, move)])
    assert.deepEqual(outcomes.map(o => [o.userId, o.payout, o.partnerId]), [[1, 150n, 2], [2, 150n, 1]])
    assert.deepEqual(outcomes[0].rep, { gave: 1 })
    assert.equal(outcomes[1].rep, undefined)
  }
})

test('greedy proposer takes 250/50 from fair or greedy responders and is marked took', () => {
  assert.deepEqual(pay([v(1, 'greedy'), v(2, 'fair')]), [[1, 250n], [2, 50n]])
  const { outcomes } = run([v(1, 'greedy'), v(2, 'greedy')])
  assert.deepEqual(outcomes.map(o => o.payout), [250n, 50n])
  assert.deepEqual(outcomes[0].rep, { took: 1 })
})

test('strict responder rejects greed: both 0, no rep', () => {
  const { outcomes } = run([v(1, 'greedy'), v(2, 'strict')])
  assert.deepEqual(outcomes.map(o => o.payout), [0n, 0n])
  assert.ok(outcomes.every(o => o.rep === undefined))
  assert.match(outcomes[0].outcome, /rejected · burned/)
})

test('equal weight: rng picks the proposer', () => {
  // first rng call feeds the pairing shuffle (0.9 keeps the order), the second the coin
  const seq = (values: number[]) => () => values.shift() ?? 0.9
  assert.deepEqual(pay([v(3, 'greedy'), v(4, 'fair')], seq([0.9, 0.2])), [[3, 250n], [4, 50n]])
  assert.deepEqual(pay([v(3, 'greedy'), v(4, 'fair')], seq([0.9, 0.9])), [[4, 150n], [3, 150n]])
})

test('odd one out is refunded', () => {
  const { outcomes } = run([v(1, 'fair'), v(2, 'fair'), v(3, 'fair')])
  assert.equal(outcomes.filter(o => o.refund).length, 1)
  assert.equal(outcomes.find(o => o.refund)!.payout, 100n)
})
