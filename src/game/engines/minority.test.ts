/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMinority } from '#root/game/engines/minority'

const weights: Record<number, number> = { 1: 10, 2: 20, 3: 7, 4: 8 }
const weightOf = (id: number) => weights[id]
const visit = (userId: number, stake = 100n) => ({ userId, move: null, stake })

// The prize is the room's stakes plus a treasury grant, so a 1500 prize for
// two visitors staking 100 each is a 1300 grant — the resolver caps that by
// turnout before it gets here (grantFor), which is what stops an empty place
// paying a full pot to whoever wanders in.
test('splits stakes plus the grant by weight', () => {
  const { outcomes, pool } = resolveMinority('Ubud', [visit(1), visit(2)], 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 500n], [2, 1000n]])
  assert.equal(outcomes[0].outcome, 'Ubud · 2 visitors · your share 500')
  // 5000 held + 200 staked - 1500 paid
  assert.equal(pool, 3700n)
})

test('uneven weight ratios split proportionally', () => {
  const { outcomes } = resolveMinority('Ubud', [visit(3), visit(4)], 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [700n, 800n])
})

test('integer division leaves the remainder in the treasury', () => {
  const w: Record<number, number> = { 1: 1, 2: 1, 3: 1 }
  const { outcomes, pool } = resolveMinority('Ubud', [visit(1, 0n), visit(2, 0n), visit(3, 0n)], 100n, 500n, id => w[id])
  assert.deepEqual(outcomes.map(o => o.payout), [33n, 33n, 33n])
  assert.equal(pool, 401n)
})

test('equal weights split equally', () => {
  const { outcomes } = resolveMinority('Ubud', [visit(1), visit(1), visit(1)], 1200n, 5000n, () => 10)
  assert.deepEqual(outcomes.map(o => o.payout), [500n, 500n, 500n])
})

test('empty place pays nothing and leaves the treasury untouched', () => {
  assert.deepEqual(resolveMinority('Ubud', [], 1500n, 5000n, weightOf), { outcomes: [], pool: 5000n })
})

test('a broke treasury just means a smaller prize, never a debt', () => {
  const { outcomes, pool } = resolveMinority('Ubud', [visit(1), visit(2)], 0n, 0n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [66n, 133n])
  assert.equal(pool, 1n)
})
