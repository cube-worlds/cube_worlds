/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStagHunt } from '#root/game/engines/stag-hunt'

const v = (userId: number, move: 'stag' | 'hare'): EngineVisit => ({ userId, move, stake: 100n })
const weights: Record<number, number> = { 4: 30 }
const weightOf = (id: number) => weights[id] ?? 10
const run = (visits: EngineVisit[]) => resolveStagHunt('Nusa Penida', visits, 100n, 1500n, weightOf)

test('hares always take the small win', () => {
  const { outcomes } = run([v(1, 'hare'), v(2, 'stag')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 120n], [2, 0n]])
  assert.equal(outcomes[1].outcome, 'Nusa Penida · 1 of 3 hunters · too few · lost 100')
  assert.equal(outcomes[1].rep, undefined)
})

test('exactly the threshold brings the stag down: stake back plus a weight share of the pot', () => {
  const { outcomes } = run([v(1, 'stag'), v(2, 'stag'), v(3, 'stag'), v(5, 'hare')])
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 600n], [2, 600n], [3, 600n], [5, 120n]])
  assert.deepEqual(outcomes[0].rep, { helped: 1 })
  assert.equal(outcomes[0].outcome, 'Nusa Penida · 3 hunters · stag down · +600')
})

test('weight splits the pot; the remainder burns', () => {
  const { outcomes } = run([v(1, 'stag'), v(2, 'stag'), v(4, 'stag')])
  // 1500 * 10/50 = 300, 300, 1500 * 30/50 = 900
  assert.deepEqual(outcomes.map(o => o.payout), [400n, 400n, 1000n])
})
