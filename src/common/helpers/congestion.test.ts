/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FLOOR_PAYOUT,
  GREEDY_MAX_MULT,
  GREEDY_MIN_MULT,
  riskMultiplier,
  settleWorld,
} from '#root/common/helpers/congestion'

test('greedy multiplier spans [0.4, 1.6] with mean 1.0', () => {
  assert.equal(GREEDY_MIN_MULT, 0.4)
  assert.equal(GREEDY_MAX_MULT, 1.6)
  assert.equal(riskMultiplier('greedy', 0), 0.4)
  assert.equal(riskMultiplier('greedy', 1), 1.6)
  assert.equal(riskMultiplier('greedy', 0.5), 1.0)
  assert.equal(riskMultiplier('safe', 0.5), 1.0) // roll ignored for safe
})

test('equal safe commitments split the pool evenly', () => {
  const awards = settleWorld(5000, [
    { expeditionId: 'a', weight: 30, risk: 'safe', riskRoll: 0 },
    { expeditionId: 'b', weight: 30, risk: 'safe', riskRoll: 0 },
  ])
  assert.deepEqual(awards, [
    { expeditionId: 'a', award: 2500 },
    { expeditionId: 'b', award: 2500 },
  ])
})

test('crowding thins each share — total never exceeds the pool', () => {
  const commitments = Array.from({ length: 100 }, (_, i) => ({
    expeditionId: String(i),
    weight: 30,
    risk: 'safe' as const,
    riskRoll: 0,
  }))
  const awards = settleWorld(5000, commitments)
  const total = awards.reduce((s, a) => s + a.award, 0)
  assert.ok(total <= 5000, `total ${total} exceeded pool`)
  assert.equal(awards[0].award, 50) // 5000 / 100
})

test('a winning greedy roll beats a safe peer of equal weight', () => {
  const awards = settleWorld(1000, [
    { expeditionId: 'greedy', weight: 30, risk: 'greedy', riskRoll: 1 }, // ×1.6
    { expeditionId: 'safe', weight: 30, risk: 'safe', riskRoll: 0 }, // ×1.0
  ])
  const greedy = awards.find((a) => a.expeditionId === 'greedy')!.award
  const safe = awards.find((a) => a.expeditionId === 'safe')!.award
  assert.ok(greedy > safe)
  assert.ok(greedy + safe <= 1000)
})

test('a lone explorer takes the whole pool', () => {
  const awards = settleWorld(5000, [
    { expeditionId: 'solo', weight: 30, risk: 'greedy', riskRoll: 0 },
  ])
  assert.deepEqual(awards, [{ expeditionId: 'solo', award: 5000 }])
})

test('an empty world mints nothing (faucet stays bounded)', () => {
  assert.deepEqual(settleWorld(5000, []), [])
})

test('shares below the floor are raised to FLOOR_PAYOUT', () => {
  assert.equal(FLOOR_PAYOUT, 1)
  const commitments = Array.from({ length: 10 }, (_, i) => ({
    expeditionId: String(i),
    weight: 1,
    risk: 'safe' as const,
    riskRoll: 0,
  }))
  const awards = settleWorld(5, commitments) // 0.5 each -> floors to 0 -> raised to 1
  assert.ok(awards.every((a) => a.award === FLOOR_PAYOUT))
})
