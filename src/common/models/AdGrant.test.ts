/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { utcDay } from '#root/common/models/AdGrant'

test('utcDay returns the UTC calendar day key', () => {
  assert.equal(utcDay(new Date('2026-06-03T23:59:59Z')), '2026-06-03')
  assert.equal(utcDay(new Date('2026-06-04T00:00:00Z')), '2026-06-04')
})
