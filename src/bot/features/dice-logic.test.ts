/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  evaluateCaptchaTrigger,
  processDiceRoll,
  shouldIncrementSuspicion,
  shouldTriggerMint,
} from '#root/bot/features/dice-logic'

// processDiceRoll — non-pair clears the series and scores plainly

test('processDiceRoll: non-pair clears series and number', () => {
  const result = processDiceRoll(
    { diceSeries: 2, diceSeriesNumber: 4 },
    3,
    5,
  )
  assert.equal(result.isRecurred, false)
  assert.equal(result.diceSeries, undefined)
  assert.equal(result.diceSeriesNumber, undefined)
  assert.equal(result.score, 8)
})

test('processDiceRoll: non-pair score is value1 + value2 with no multiplier', () => {
  const result = processDiceRoll({}, 1, 6)
  assert.equal(result.score, 7)
  assert.equal(result.isRecurred, false)
})

// processDiceRoll — first pair starts a fresh series

test('processDiceRoll: pair from empty state starts series at 1, score not multiplied', () => {
  const result = processDiceRoll({}, 4, 4)
  assert.equal(result.isRecurred, true)
  assert.equal(result.diceSeries, 1)
  assert.equal(result.diceSeriesNumber, 4)
  // diceSeries === 1 → no multiplier
  assert.equal(result.score, 8)
})

test('processDiceRoll: pair after a non-pair starts a fresh series at 1', () => {
  const result = processDiceRoll(
    { diceSeries: undefined, diceSeriesNumber: undefined },
    2,
    2,
  )
  assert.equal(result.diceSeries, 1)
  assert.equal(result.diceSeriesNumber, 2)
  assert.equal(result.score, 4)
})

// processDiceRoll — matching pair extends the series and multiplies the score

test('processDiceRoll: matching pair increments series and multiplies score', () => {
  const result = processDiceRoll(
    { diceSeries: 1, diceSeriesNumber: 5 },
    5,
    5,
  )
  assert.equal(result.diceSeries, 2)
  assert.equal(result.diceSeriesNumber, 5)
  // score = (5+5) * 2 = 20
  assert.equal(result.score, 20)
})

test('processDiceRoll: third matching pair triggers the mint-winning series of 3', () => {
  const result = processDiceRoll(
    { diceSeries: 2, diceSeriesNumber: 6 },
    6,
    6,
  )
  assert.equal(result.diceSeries, 3)
  assert.equal(result.diceSeriesNumber, 6)
  // score = (6+6) * 3 = 36
  assert.equal(result.score, 36)
})

// processDiceRoll — pair with a different number resets to 1

test('processDiceRoll: pair with a different number resets series to 1', () => {
  const result = processDiceRoll(
    { diceSeries: 2, diceSeriesNumber: 4 },
    3,
    3,
  )
  assert.equal(result.diceSeries, 1)
  assert.equal(result.diceSeriesNumber, 3)
  // diceSeries === 1 → no multiplier even though previous series was 2
  assert.equal(result.score, 6)
})

test('processDiceRoll: does not mutate the input state', () => {
  const current = { diceSeries: 2, diceSeriesNumber: 4 }
  processDiceRoll(current, 4, 4)
  assert.equal(current.diceSeries, 2)
  assert.equal(current.diceSeriesNumber, 4)
})

// shouldIncrementSuspicion — boundary inside the 3× wait window

test('shouldIncrementSuspicion: now inside lastDicedAt + 3 × waitMinutes is suspicious', () => {
  const last = new Date('2026-01-01T00:00:00Z')
  // waitMinutes = 5 → window is 15 minutes; now = +10 min is inside
  const now = new Date(last.getTime() + 10 * 60 * 1000)
  assert.equal(shouldIncrementSuspicion(last, now, 5), true)
})

test('shouldIncrementSuspicion: now exactly at the window boundary is NOT suspicious (strict >)', () => {
  const last = new Date('2026-01-01T00:00:00Z')
  // waitMinutes = 5 → boundary at +15 min
  const now = new Date(last.getTime() + 15 * 60 * 1000)
  assert.equal(shouldIncrementSuspicion(last, now, 5), false)
})

test('shouldIncrementSuspicion: now after the window is NOT suspicious', () => {
  const last = new Date('2026-01-01T00:00:00Z')
  const now = new Date(last.getTime() + 16 * 60 * 1000)
  assert.equal(shouldIncrementSuspicion(last, now, 5), false)
})

test('shouldIncrementSuspicion: dev waitMinutes = 1 gives a 3-minute window', () => {
  const last = new Date('2026-01-01T00:00:00Z')
  // 2 min in → suspicious
  assert.equal(
    shouldIncrementSuspicion(last, new Date(last.getTime() + 2 * 60 * 1000), 1),
    true,
  )
  // 3 min in → boundary, NOT suspicious
  assert.equal(
    shouldIncrementSuspicion(last, new Date(last.getTime() + 3 * 60 * 1000), 1),
    false,
  )
})

// evaluateCaptchaTrigger — threshold and derived values

test('evaluateCaptchaTrigger: below 105 → no trigger', () => {
  const result = evaluateCaptchaTrigger(104)
  assert.equal(result.trigger, false)
  assert.equal(result.enemies, 4)
  assert.equal(result.expectedKills, 3)
})

test('evaluateCaptchaTrigger: exactly 105 → triggers (>=)', () => {
  const result = evaluateCaptchaTrigger(105)
  assert.equal(result.trigger, true)
  assert.equal(result.enemies, 5)
  assert.equal(result.expectedKills, 4)
})

test('evaluateCaptchaTrigger: well above the threshold scales linearly', () => {
  const result = evaluateCaptchaTrigger(150)
  assert.equal(result.trigger, true)
  assert.equal(result.enemies, 50)
  assert.equal(result.expectedKills, 49)
})

test('evaluateCaptchaTrigger: zero suspicionDices yields negative enemies but no trigger', () => {
  const result = evaluateCaptchaTrigger(0)
  assert.equal(result.trigger, false)
  assert.equal(result.enemies, -100)
  assert.equal(result.expectedKills, -101)
})

// shouldTriggerMint — only fires when not minted AND series is exactly 3

test('shouldTriggerMint: not minted with diceSeries === 3 → true', () => {
  assert.equal(shouldTriggerMint({ minted: false, diceSeries: 3 }), true)
})

test('shouldTriggerMint: minted user never wins again', () => {
  assert.equal(shouldTriggerMint({ minted: true, diceSeries: 3 }), false)
})

test('shouldTriggerMint: diceSeries other than 3 does not trigger', () => {
  assert.equal(shouldTriggerMint({ minted: false, diceSeries: 1 }), false)
  assert.equal(shouldTriggerMint({ minted: false, diceSeries: 2 }), false)
  assert.equal(shouldTriggerMint({ minted: false, diceSeries: 4 }), false)
})

test('shouldTriggerMint: undefined diceSeries does not trigger', () => {
  assert.equal(
    shouldTriggerMint({ minted: false, diceSeries: undefined }),
    false,
  )
})

test('shouldTriggerMint: undefined minted treated as not-minted', () => {
  assert.equal(shouldTriggerMint({ minted: undefined, diceSeries: 3 }), true)
})
