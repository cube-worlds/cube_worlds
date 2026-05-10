/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildVoteHelpers } from '#root/common/models/Vote'

// isUserAlreadyVoted — coerces the findOne result to boolean

test('isUserAlreadyVoted returns false when no vote document is found', async () => {
  const findCalls: number[] = []
  const helpers = buildVoteHelpers({
    findGiver: async (giver) => {
      findCalls.push(giver)
      return null
    },
    countByReceiver: async () => 0,
  })

  assert.equal(await helpers.isUserAlreadyVoted(42), false)
  assert.deepEqual(findCalls, [42])
})

test('isUserAlreadyVoted returns true when a vote document exists', async () => {
  const helpers = buildVoteHelpers({
    findGiver: async () => ({ giver: 1, receiver: 2, quantity: 100 }),
    countByReceiver: async () => 0,
  })

  assert.equal(await helpers.isUserAlreadyVoted(1), true)
})

test('isUserAlreadyVoted treats undefined like missing', async () => {
  const helpers = buildVoteHelpers({
    findGiver: async () => undefined,
    countByReceiver: async () => 0,
  })

  assert.equal(await helpers.isUserAlreadyVoted(1), false)
})

// referralsCount — passes through the numeric count

test('referralsCount returns 0 when no referrals', async () => {
  const helpers = buildVoteHelpers({
    findGiver: async () => null,
    countByReceiver: async () => 0,
  })
  assert.equal(await helpers.referralsCount(99), 0)
})

test('referralsCount forwards the receiver id and returns the count', async () => {
  const countCalls: number[] = []
  const helpers = buildVoteHelpers({
    findGiver: async () => null,
    countByReceiver: async (receiver) => {
      countCalls.push(receiver)
      return 7
    },
  })

  assert.equal(await helpers.referralsCount(123), 7)
  assert.deepEqual(countCalls, [123])
})
