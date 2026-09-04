/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TRAIT, parseTraits, topTraits, traitOf, weightOf } from '#root/game/traits'

test('parseTraits reads trait_type/value pairs and ignores junk', () => {
  const traits = parseTraits([
    { trait_type: 'Courage', value: 7 },
    { trait_type: 'Charm', value: '9' },
    { trait_type: 'Type', value: 'Whale' },
    { nope: 1 },
    null,
  ])
  assert.deepEqual(traits, { Courage: 7, Charm: 9 })
})

test('parseTraits returns {} for non-arrays', () => {
  assert.deepEqual(parseTraits(undefined), {})
  assert.deepEqual(parseTraits('x'), {})
})

test('traitOf defaults to 5 when missing or traits undefined', () => {
  assert.equal(traitOf({ Courage: 9 }, 'Courage'), 9)
  assert.equal(traitOf({ Courage: 9 }, 'Charm'), DEFAULT_TRAIT)
  assert.equal(traitOf(undefined, 'Charm'), DEFAULT_TRAIT)
})

test('weightOf sums the named traits with defaults', () => {
  assert.equal(weightOf({ A: 10, B: 1 }, ['A', 'B', 'C']), 16)
  assert.equal(weightOf(undefined, ['A', 'B', 'C']), 15)
})

test('topTraits returns the n highest, ties by name', () => {
  assert.deepEqual(topTraits({ B: 10, A: 10, C: 3, D: 8 }, 3), [
    { name: 'A', value: 10 },
    { name: 'B', value: 10 },
    { name: 'D', value: 8 },
  ])
})
