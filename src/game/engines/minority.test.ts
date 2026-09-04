/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMinority } from '#root/game/engines/minority'

const weights: Record<number, number> = { 1: 10, 2: 20, 3: 7, 4: 8 }
const weightOf = (id: number) => weights[id]
const visit = (userId: number) => ({ userId, move: null, stake: 100n })

test('splits the pot by weight', () => {
  const { outcomes, pool } = resolveMinority('Ubud', [visit(1), visit(2)], 1500n, weightOf)
  assert.equal(pool, undefined)
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 500n], [2, 1000n]])
  assert.equal(outcomes[0].outcome, 'Ubud · 2 visitors · your share 500')
})

test('uneven weight ratios split proportionally', () => {
  const { outcomes } = resolveMinority('Ubud', [visit(3), visit(4)], 1500n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [700n, 800n])
})

test('integer division burns the remainder', () => {
  const w: Record<number, number> = { 1: 1, 2: 1, 3: 1 }
  const { outcomes } = resolveMinority('Ubud', [visit(1), visit(2), visit(3)], 100n, id => w[id])
  assert.deepEqual(outcomes.map(o => o.payout), [33n, 33n, 33n])
})

test('equal weights split equally', () => {
  const { outcomes } = resolveMinority('Ubud', [visit(1), visit(1), visit(1)], 1500n, () => 10)
  assert.deepEqual(outcomes.map(o => o.payout), [500n, 500n, 500n])
})

test('empty place mints nothing', () => {
  assert.deepEqual(resolveMinority('Ubud', [], 1500n, weightOf), { outcomes: [] })
})
