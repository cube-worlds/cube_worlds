/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { isFounder } from '#root/common/helpers/founder'

test('a minted CNFT holder is a Founder', () => {
  assert.equal(isFounder({ minted: true }), true)
})

test('a non-minted user is not a Founder', () => {
  assert.equal(isFounder({ minted: false }), false)
  assert.equal(isFounder({}), false)
})
