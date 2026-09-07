/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { ALL_MOVES, findPlace, movesFor, PLACES, stakeFor, WINDOW_MS, windowEndsAt, windowIdAt } from '#root/game/places'

test('windows are 8h, aligned to UTC midnight', () => {
  assert.equal(WINDOW_MS, 8 * 60 * 60 * 1000)
  const midnight = Date.UTC(2026, 8, 4, 0, 0, 0)
  const id = windowIdAt(midnight)
  assert.equal(windowIdAt(midnight + WINDOW_MS - 1), id)
  assert.equal(windowIdAt(midnight + WINDOW_MS), id + 1)
  assert.equal(windowEndsAt(id), midnight + WINDOW_MS)
})

test('fourteen places, all open, ids unique', () => {
  assert.equal(PLACES.length, 14)
  assert.equal(PLACES.filter(p => p.open).length, 14)
  assert.ok(!PLACES.some(p => p.engine === 'soon'))
  assert.equal(new Set(PLACES.map(p => p.id)).size, 14)
  for (const p of PLACES) {
    if (p.engine !== 'rest') assert.equal(p.traits.length, 3, `${p.id} needs three traits`)
  }
})

test('findPlace and movesFor', () => {
  assert.equal(findPlace('canggu')?.engine, 'split-steal')
  assert.equal(findPlace('nowhere'), undefined)
  assert.deepEqual(movesFor('split-steal'), ['help', 'steal'])
  assert.deepEqual(movesFor('commons'), ['give', 'take'])
  assert.deepEqual(movesFor('minority'), [])
  assert.deepEqual(movesFor('rest'), [])
})

test('stakeFor returns the bid tier at Seminyak and the flat stake elsewhere', () => {
  const seminyak = findPlace('seminyak')!
  assert.equal(stakeFor(seminyak, 'bid1'), 200n)
  assert.equal(stakeFor(seminyak, 'bid3'), 5000n)
  assert.equal(stakeFor(seminyak, null), 200n)
  assert.equal(stakeFor(findPlace('kuta')!, 'hawk'), 100n)
  assert.equal(stakeFor(findPlace('ubud')!, null), 100n)
})

test('moves per slice-2 engine, ALL_MOVES is the deduped union', () => {
  assert.deepEqual(movesFor('hawk-dove'), ['hawk', 'dove'])
  assert.deepEqual(movesFor('heist'), ['loyal', 'betray'])
  assert.deepEqual(movesFor('all-pay'), ['bid1', 'bid2', 'bid3'])
  assert.deepEqual(movesFor('volunteer'), ['dive', 'wait'])
  assert.deepEqual(movesFor('stag-hunt'), ['stag', 'hare'])
  assert.deepEqual(movesFor('ultimatum'), ['fair', 'greedy', 'strict'])
  assert.equal(ALL_MOVES.length, 18)
  assert.equal(new Set(ALL_MOVES).size, 18)
})
