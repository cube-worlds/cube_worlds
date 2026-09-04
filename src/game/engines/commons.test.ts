/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCommons } from '#root/game/engines/commons'

const w: Record<number, number> = { 1: 10, 2: 30, 3: 5, 4: 5, 5: 5 }
const weightOf = (id: number) => w[id] ?? 5
const v = (userId: number, move: 'give' | 'take'): EngineVisit => ({ userId, move, stake: 100n })
const byUser = (r: ReturnType<typeof resolveCommons>) => Object.fromEntries(r.outcomes.map(o => [o.userId, o]))

test('gives enter, growth pays givers by weight, takers draw from the pool', () => {
  const r = resolveCommons('Besakih', [v(1, 'give'), v(2, 'give'), v(3, 'take')], 100n, 5000n, 5000n, weightOf)
  // pool 5000 + 200 = 5200; growth min(1040, 2000) = 1040 → 260 / 780; taker min(300, 5200) = 300 → 4900
  const out = byUser(r)
  assert.equal(out[1].payout, 260n)
  assert.equal(out[2].payout, 780n)
  assert.equal(out[3].payout, 300n)
  assert.equal(r.pool, 4900n)
  assert.deepEqual(out[1].rep, { gave: 1 })
  assert.deepEqual(out[3].rep, { took: 1 })
  assert.equal(out[1].outcome, 'Besakih · you gave · +260 growth · pool 4900')
  assert.equal(out[3].outcome, 'Besakih · you took · +300 · pool 4900')
})

test('growth is capped', () => {
  const r = resolveCommons('Besakih', [v(1, 'give')], 100n, 5000n, 20000n, weightOf)
  assert.equal(byUser(r)[1].payout, 2000n)
  assert.equal(r.pool, 20100n)
})

test('no givers → no growth minted', () => {
  const r = resolveCommons('Besakih', [v(3, 'take')], 100n, 5000n, 1000n, weightOf)
  assert.equal(byUser(r)[3].payout, 300n)
  assert.equal(r.pool, 700n)
})

test('take is capped by the pool when it runs dry', () => {
  const r = resolveCommons('Besakih', [v(3, 'take'), v(4, 'take')], 100n, 5000n, 100n, weightOf)
  assert.equal(byUser(r)[3].payout, 50n)
  assert.equal(r.pool, 0n)
})

test('collapse at three takers outnumbering givers', () => {
  const r = resolveCommons('Besakih', [v(1, 'give'), v(2, 'give'), v(3, 'take'), v(4, 'take'), v(5, 'take')], 100n, 5000n, 5000n, weightOf)
  const out = byUser(r)
  assert.equal(out[3].payout, 0n)
  assert.equal(r.pool, 2500n)
  assert.deepEqual(out[3].rep, { took: 1 })
  assert.equal(out[3].outcome, 'Besakih · you took · plundered · pool 2500')
  assert.equal(out[1].outcome, 'Besakih · you gave · +260 growth · plundered · pool 2500')
})

test('three takers with three givers do not collapse', () => {
  const r = resolveCommons('Besakih', [v(1, 'give'), v(2, 'give'), v(5, 'give'), v(3, 'take'), v(4, 'take'), v(3, 'take')], 100n, 5000n, 5000n, weightOf)
  assert.notEqual(r.pool, 2500n)
  assert.equal(byUser(r)[4].payout, 300n)
})

test('empty place leaves the pool untouched', () => {
  assert.deepEqual(resolveCommons('Besakih', [], 100n, 5000n, 4321n, weightOf), { outcomes: [], pool: 4321n })
})
