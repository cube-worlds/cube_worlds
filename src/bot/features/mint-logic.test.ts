/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isSubscribedStatus,
  SUBSCRIBED_STATUSES,
} from '#root/bot/features/mint-logic'

// SUBSCRIBED_STATUSES — exposes the canonical set

test('SUBSCRIBED_STATUSES lists creator, administrator, member', () => {
  assert.deepEqual(
    [...SUBSCRIBED_STATUSES],
    ['creator', 'administrator', 'member'],
  )
})

// isSubscribedStatus — accepts the three "active member" roles

test('isSubscribedStatus accepts "member"', () => {
  assert.equal(isSubscribedStatus('member'), true)
})

test('isSubscribedStatus accepts "administrator"', () => {
  assert.equal(isSubscribedStatus('administrator'), true)
})

test('isSubscribedStatus accepts "creator"', () => {
  assert.equal(isSubscribedStatus('creator'), true)
})

// isSubscribedStatus — rejects every other documented Telegram status

test('isSubscribedStatus rejects "left" (user left the chat)', () => {
  assert.equal(isSubscribedStatus('left'), false)
})

test('isSubscribedStatus rejects "kicked" (banned)', () => {
  assert.equal(isSubscribedStatus('kicked'), false)
})

test('isSubscribedStatus rejects "restricted"', () => {
  assert.equal(isSubscribedStatus('restricted'), false)
})

test('isSubscribedStatus rejects an empty status', () => {
  assert.equal(isSubscribedStatus(''), false)
})

test('isSubscribedStatus is case-sensitive (upper-case Member is not accepted)', () => {
  assert.equal(isSubscribedStatus('Member'), false)
  assert.equal(isSubscribedStatus('CREATOR'), false)
})
