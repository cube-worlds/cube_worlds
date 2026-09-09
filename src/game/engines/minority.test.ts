/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMinority } from '#root/game/engines/minority'

const weights: Record<number, number> = { 1: 10, 2: 20, 3: 7, 4: 8, 5: 5 }
const weightOf = (id: number) => weights[id]
const visit = (userId: number, move: 'sunrise' | 'sunset' | null, stake = 100n) => ({ userId, move, stake })

// The prize is the whole room's stakes plus a treasury grant — the majority
// funds the minority. The resolver caps the grant by turnout before it gets
// here (grantFor), which is what stops an empty place paying a full pot.
test('the smaller side takes the room, the crowded side loses its stake', () => {
  const visits = [visit(1, 'sunrise'), visit(2, 'sunset'), visit(3, 'sunset')]
  const { outcomes, pool } = resolveMinority('Ubud', visits, 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 1600n], [2, 0n], [3, 0n]])
  assert.equal(outcomes[0].outcome, 'Ubud · sunrise · 1 of 3 · blessed · +1600')
  assert.equal(outcomes[1].outcome, 'Ubud · sunset was crowded · lost 100')
  // 5000 held + 300 staked - 1600 paid
  assert.equal(pool, 3700n)
})

test('the blessed side splits by trait weight', () => {
  const visits = [visit(3, 'sunrise'), visit(4, 'sunrise'), visit(1, 'sunset'), visit(2, 'sunset'), visit(5, 'sunset')]
  const { outcomes } = resolveMinority('Ubud', visits, 1000n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [700n, 800n, 0n, 0n, 0n])
})

test('a dead heat is refunded — no minority formed', () => {
  const visits = [visit(1, 'sunrise'), visit(2, 'sunset')]
  const { outcomes, pool } = resolveMinority('Ubud', visits, 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [100n, 100n])
  assert.ok(outcomes.every(o => o.refund))
  assert.equal(outcomes[0].outcome, 'Ubud · no minority · the shrines drew even · refunded 100')
  assert.equal(pool, 5000n)
})

test('everyone on one shrine is refunded too', () => {
  const visits = [visit(1, 'sunrise'), visit(2, 'sunrise'), visit(3, 'sunrise')]
  const { outcomes, pool } = resolveMinority('Ubud', visits, 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [100n, 100n, 100n])
  assert.equal(pool, 5000n)
})

test('a lone visitor gets their stake back', () => {
  const { outcomes } = resolveMinority('Ubud', [visit(1, 'sunrise')], 1300n, 5000n, weightOf)
  assert.equal(outcomes[0].outcome, 'Ubud · nobody else came · refunded 100')
  assert.equal(outcomes[0].payout, 100n)
})

// Visits committed before these places had a move still have to settle.
test('a legacy null move counts as sunset', () => {
  const visits = [visit(1, 'sunrise'), visit(2, null), visit(3, null)]
  const { outcomes } = resolveMinority('Ubud', visits, 1300n, 5000n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [1600n, 0n, 0n])
  assert.equal(outcomes[1].outcome, 'Ubud · sunset was crowded · lost 100')
})

test('integer division leaves the remainder in the treasury', () => {
  const w: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
  const visits = [visit(1, 'sunrise', 0n), visit(2, 'sunrise', 0n), visit(3, 'sunset', 0n), visit(4, 'sunset', 0n), visit(5, 'sunset', 0n)]
  const { outcomes, pool } = resolveMinority('Ubud', visits, 101n, 500n, id => w[id])
  assert.deepEqual(outcomes.map(o => o.payout), [50n, 50n, 0n, 0n, 0n])
  assert.equal(pool, 400n)
})

test('empty place pays nothing and leaves the treasury untouched', () => {
  assert.deepEqual(resolveMinority('Ubud', [], 1500n, 5000n, weightOf), { outcomes: [], pool: 5000n })
})

test('a broke treasury just means a smaller prize, never a debt', () => {
  const visits = [visit(1, 'sunrise'), visit(2, 'sunset'), visit(3, 'sunset')]
  const { outcomes, pool } = resolveMinority('Ubud', visits, 1000n, 0n, weightOf)
  assert.deepEqual(outcomes.map(o => o.payout), [300n, 0n, 0n])
  assert.equal(pool, 0n)
})
