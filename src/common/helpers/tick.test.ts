/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { currentTickId, isTickClosed, TICK_MS, tickEnd, tickStart } from '#root/common/helpers/tick'

test('TICK_MS is one hour', () => {
  assert.equal(TICK_MS, 3_600_000)
})

test('currentTickId floors epoch ms into hour buckets', () => {
  assert.equal(currentTickId(new Date(0)), 0)
  assert.equal(currentTickId(new Date(3_599_999)), 0)
  assert.equal(currentTickId(new Date(3_600_000)), 1)
  assert.equal(currentTickId(new Date(7_200_001)), 2)
})

test('tickStart and tickEnd bracket the tick', () => {
  assert.equal(tickStart(2).getTime(), 7_200_000)
  assert.equal(tickEnd(2).getTime(), 10_800_000)
})

test('isTickClosed is true only once now reaches the next tick', () => {
  assert.equal(isTickClosed(0, new Date(3_599_999)), false)
  assert.equal(isTickClosed(0, new Date(3_600_000)), true)
})
