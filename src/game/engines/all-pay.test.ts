/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAllPay } from '#root/game/engines/all-pay'

const v = (userId: number, stake: bigint): EngineVisit => ({ userId, move: 'bid1', stake })
const weights: Record<number, number> = { 1: 10, 2: 20 }
const weightOf = (id: number) => weights[id] ?? 10
const run = (visits: EngineVisit[], rng: () => number = () => 0) => resolveAllPay('Seminyak', visits, 3000n, weightOf, rng)

test('single bidder is refunded', () => {
  const { outcomes } = run([v(1, 5000n)])
  assert.deepEqual(outcomes, [{ userId: 1, payout: 5000n, outcome: 'Seminyak · nobody to outbid · refunded 5000', refund: true }])
})

test('highest bid wins the capped prize, losers get 0 and point at the winner', () => {
  const { outcomes } = run([v(1, 200n), v(2, 1000n), v(3, 5000n)])
  assert.deepEqual(outcomes[0], { userId: 3, payout: 3000n, outcome: 'Seminyak · face of the window · +3000' })
  assert.deepEqual(outcomes.slice(1).map(o => [o.userId, o.payout, o.partnerId]), [[2, 0n, 3], [1, 0n, 3]])
  assert.equal(outcomes[1].outcome, 'Seminyak · outbid · lost 1000')
  assert.ok(outcomes.every(o => o.rep === undefined))
})

test('below the cap the whole pot is the prize', () => {
  const { outcomes } = run([v(1, 200n), v(2, 1000n)])
  assert.equal(outcomes[0].payout, 1200n)
})

test('tie on bid: higher weight wins; tie on weight: rng', () => {
  assert.equal(run([v(1, 1000n), v(2, 1000n)]).outcomes[0].userId, 2)
  assert.equal(run([v(3, 1000n), v(4, 1000n)], () => 0).outcomes[0].userId, 4)
  assert.equal(run([v(3, 1000n), v(4, 1000n)], () => 0.99).outcomes[0].userId, 3)
})
