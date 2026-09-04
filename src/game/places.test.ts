/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { findPlace, movesFor, PLACES, WINDOW_MS, windowEndsAt, windowIdAt } from '#root/game/places'

test('windows are 8h, aligned to UTC midnight', () => {
  assert.equal(WINDOW_MS, 8 * 60 * 60 * 1000)
  const midnight = Date.UTC(2026, 8, 4, 0, 0, 0)
  const id = windowIdAt(midnight)
  assert.equal(windowIdAt(midnight + WINDOW_MS - 1), id)
  assert.equal(windowIdAt(midnight + WINDOW_MS), id + 1)
  assert.equal(windowEndsAt(id), midnight + WINDOW_MS)
})

test('fourteen places, eight open, ids unique', () => {
  assert.equal(PLACES.length, 14)
  assert.equal(PLACES.filter(p => p.open).length, 8)
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
