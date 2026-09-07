/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHeist } from '#root/game/engines/heist'

const v = (userId: number, move: 'loyal' | 'betray'): EngineVisit => ({ userId, move, stake: 100n })
const weights: Record<number, number> = { 1: 10, 2: 10, 3: 20 }
const traits: Record<number, Record<string, number>> = { 1: { Perception: 8 }, 2: { Perception: 4 }, 3: { Deceptiveness: 9 }, 4: { Deceptiveness: 2 } }
const weightOf = (id: number) => weights[id] ?? 10
const traitOf = (id: number, name: string) => traits[id]?.[name] ?? 5
const run = (visits: EngineVisit[]) => resolveHeist('Uluwatu', visits, 100n, 1000n, weightOf, traitOf)

test('crew of one is refunded', () => {
  const { outcomes } = run([v(1, 'loyal')])
  assert.deepEqual(outcomes, [{ userId: 1, payout: 100n, outcome: 'Uluwatu · no crew · refunded 100', refund: true }])
})

test('all loyal: stakes plus pot split by weight, helped', () => {
  const { outcomes } = run([v(1, 'loyal'), v(2, 'loyal'), v(3, 'loyal')])
  // loot 300 + 1000 = 1300, weights 10/10/20
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 325n], [2, 325n], [3, 650n]])
  assert.deepEqual(outcomes.map(o => o.rep), [{ helped: 1 }, { helped: 1 }, { helped: 1 }])
  assert.equal(outcomes[0].outcome, 'Uluwatu · clean heist · crew of 3 · +325')
})

test('betrayer minority takes a double share; concealed when Deceptiveness beats the best loyal eye', () => {
  const { outcomes } = run([v(1, 'loyal'), v(2, 'loyal'), v(3, 'betray')])
  // loot 1300 / (2 + 2) = 325 per unit
  assert.deepEqual(outcomes.map(o => [o.userId, o.payout]), [[1, 325n], [2, 325n], [3, 650n]])
  assert.equal(outcomes[0].outcome, 'Uluwatu · heist · betrayed by 1 · +325')
  assert.deepEqual(outcomes[0].rep, { helped: 1 })
  assert.equal(outcomes[2].rep, undefined) // Deceptiveness 9 > max Perception 8
})

test('a clumsy betrayer is marked stole', () => {
  const { outcomes } = run([v(1, 'loyal'), v(2, 'loyal'), v(4, 'betray')])
  assert.deepEqual(outcomes[2].rep, { stole: 1 }) // Deceptiveness 2 < 8
})

test('betrayers >= loyal: guards wake up, everyone 0, betrayers all marked', () => {
  const { outcomes } = run([v(1, 'loyal'), v(3, 'betray'), v(4, 'betray')])
  assert.deepEqual(outcomes.map(o => o.payout), [0n, 0n, 0n])
  assert.equal(outcomes[0].rep, undefined)
  assert.deepEqual(outcomes[1].rep, { stole: 1 })
  assert.deepEqual(outcomes[2].rep, { stole: 1 })
  assert.match(outcomes[0].outcome, /guards woke up/)
})

test('integer division burns the remainder', () => {
  const { outcomes } = run([v(1, 'loyal'), v(2, 'loyal'), v(5, 'loyal'), v(6, 'betray')])
  // loot 400 + 1000 = 1400 / (3 + 2) = 280
  assert.deepEqual(outcomes.map(o => o.payout), [280n, 280n, 280n, 560n])
})
